import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getModule } from "@/lib/modules";
import { buildMessages, getClient, SYSTEM_PROMPT, type Citation } from "@/modules/ai/service";
import { getAiStatus, resolveProvider } from "@/modules/ai/policy";
import { claudeCostUsd, supportsEffort } from "@/modules/ai/pricing";
import { FreeProviderError, rulebookPages, selectPages, streamFree, type FreeMessage } from "@/modules/ai/free";

// Streams the answer as newline-delimited JSON events:
//   {type:"chat", id} {type:"provider", provider, switched} {type:"text", text}
//   {type:"citation", page, endPage, text} {type:"done"} {type:"error", code}

const bodySchema = z.object({
  chatId: z.string().optional(),
  gameId: z.string().optional(),
  rulebookId: z.string().optional(),
  provider: z.enum(["claude", "free"]).default("claude"),
  question: z.string().trim().min(1).max(4000),
});

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const FREE_ADDENDUM = `

Rulebook excerpts, when provided, are marked with [Page N]. Base your answer on them and cite pages in the form (p. N). If the excerpts don't contain the answer, say so.`;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const mod = await getModule("ai");
  if (!mod.enabled) return Response.json({ error: "disabled" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { question } = parsed.data;

  const status = await getAiStatus(user.id, mod);
  const decision = resolveProvider(status, parsed.data.provider, Boolean(mod.settings.autoFallbackToFree));
  if ("error" in decision) return Response.json({ error: decision.error }, { status: 403 });

  // Load or create the conversation.
  const include = { game: true, rulebook: { include: { file: true } }, messages: { orderBy: { createdAt: "asc" as const } } };
  let chat = parsed.data.chatId ? await db.aiChat.findFirst({ where: { id: parsed.data.chatId, userId: user.id }, include }) : null;
  if (!chat) {
    const game = parsed.data.gameId ? await db.game.findUnique({ where: { id: parsed.data.gameId } }) : null;
    const rulebook =
      parsed.data.rulebookId && game ? await db.rulebook.findFirst({ where: { id: parsed.data.rulebookId, gameId: game.id } }) : null;
    if (!rulebook && !mod.settings.allowGeneralKnowledge) return Response.json({ error: "rulebookRequired" }, { status: 400 });
    chat = await db.aiChat.create({
      data: { userId: user.id, gameId: game?.id, rulebookId: rulebook?.id, title: question.slice(0, 80) },
      include,
    });
  }
  const conversation = chat;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      send({ type: "chat", id: conversation.id });
      send({ type: "provider", provider: decision.provider, switched: decision.switched, reason: status.claude.reason ?? null });

      let answer = "";
      const citations: Citation[] = [];
      let usage = { model: "", inputTokens: 0, outputTokens: 0, costUsd: 0 };
      let provider = decision.provider;

      const runFree = async () => {
        const s = mod.settings;
        let excerpt = "";
        if (conversation.rulebook) {
          const pages = selectPages(await rulebookPages(conversation.rulebook), question, Number(s.freeMaxContextChars));
          excerpt = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join("\n\n");
        }
        const context = conversation.game
          ? `Game: ${conversation.game.name}${conversation.rulebook ? `\nRulebook: ${conversation.rulebook.title}` : "\nNo rulebook attached."}`
          : "No specific game selected.";
        const messages: FreeMessage[] = [
          { role: "system", content: SYSTEM_PROMPT + FREE_ADDENDUM },
          ...conversation.messages.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
          { role: "user", content: `${context}${excerpt ? `\n\nRulebook excerpts:\n${excerpt}` : ""}\n\nQuestion: ${question}` },
        ];
        for await (const text of streamFree({ baseUrl: String(s.freeBaseUrl), model: String(s.freeModel), messages, signal: req.signal })) {
          answer += text;
          send({ type: "text", text });
        }
        usage = { model: String(s.freeModel), inputTokens: 0, outputTokens: 0, costUsd: 0 };
      };

      try {
        await db.aiMessage.create({ data: { chatId: conversation.id, role: "user", content: question } });

        if (provider === "claude") {
          try {
            const model = String(mod.settings.model) || "claude-opus-5-5";
            const messages = await buildMessages(conversation, question);
            const advanced = supportsEffort(model);
            const response = getClient().beta.messages.stream(
              {
                model,
                max_tokens: 16000,
                system: SYSTEM_PROMPT,
                messages,
                cache_control: { type: "ephemeral" },
                ...(advanced
                  ? {
                      output_config: { effort: (String(mod.settings.effort) || "medium") as Effort },
                      betas: ["server-side-fallback-2026-07-01"],
                      fallbacks: "default" as const,
                    }
                  : {}),
              },
              { signal: req.signal },
            );
            for await (const event of response) {
              if (event.type !== "content_block_delta") continue;
              if (event.delta.type === "text_delta") {
                answer += event.delta.text;
                send({ type: "text", text: event.delta.text });
              } else if (event.delta.type === "citations_delta" && event.delta.citation.type === "page_location") {
                const c = event.delta.citation;
                const citation = { page: c.start_page_number, endPage: c.end_page_number, text: c.cited_text.slice(0, 400) };
                if (!citations.some((x) => x.page === citation.page && x.text === citation.text)) {
                  citations.push(citation);
                  send({ type: "citation", ...citation });
                }
              }
            }
            const final = await response.finalMessage();
            if (final.stop_reason === "refusal") send({ type: "error", code: "refusal" });
            usage = {
              model: final.model,
              inputTokens: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0),
              outputTokens: final.usage.output_tokens,
              costUsd: claudeCostUsd(final.model, final.usage),
            };
          } catch (err) {
            // Claude failed before saying anything (bad key, outage…): let the free option answer.
            const aborted = err instanceof Anthropic.APIUserAbortError;
            if (answer || aborted || !status.free.available || !mod.settings.autoFallbackToFree) throw err;
            console.error("[ai] Claude failed, answering with the free option:", err);
            provider = "free";
            send({ type: "provider", provider: "free", switched: true, reason: "claudeError" });
            await runFree();
          }
        } else {
          await runFree();
        }

        await db.aiMessage.create({
          data: {
            chatId: conversation.id,
            role: "assistant",
            content: answer || "…",
            citations: citations.length ? JSON.stringify(citations) : null,
            provider,
            ...usage,
          },
        });
        await db.aiChat.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
        send({ type: "done" });
      } catch (error) {
        let code = "unknown";
        if (error instanceof Anthropic.AuthenticationError) code = "notConfigured";
        else if (error instanceof Anthropic.RateLimitError) code = "busy";
        else if (error instanceof Anthropic.APIError) code = "api";
        else if (error instanceof FreeProviderError) code = error.status === 429 ? "freeBusy" : "freeError";
        console.error("[ai] answer failed:", error);
        if (answer) {
          await db.aiMessage
            .create({ data: { chatId: conversation.id, role: "assistant", content: answer, provider, ...usage } })
            .catch(() => {});
        }
        send({ type: "error", code });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

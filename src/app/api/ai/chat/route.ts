import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getModule } from "@/lib/modules";
import { buildMessages, getClient, SYSTEM_PROMPT, type Citation } from "@/modules/ai/service";
import { getAiStatus, resolveProvider } from "@/modules/ai/policy";
import { inMemberKallax } from "@/modules/games/service";
import { claudeCostUsd, supportsEffort } from "@/modules/ai/pricing";
import { FreeProviderError, rulebookPages, selectPages, streamFree, type FreeMessage } from "@/modules/ai/free";
import { faqEnabled, findFaqMatch, recordFaq } from "@/modules/ai/faq";
import { getOwnKey } from "@/modules/ai/ownKey";

// Streams the answer as newline-delimited JSON events:
//   {type:"chat", id} {type:"provider", provider, switched} {type:"text", text}
//   {type:"citation", page, endPage, text} {type:"done"} {type:"error", code}
//   {type:"faq", id, question} — the answer comes from the game's FAQ, not the AI
//
// Every question about a game is first looked up in that game's FAQ (free, instant);
// the AI is called only when the FAQ has nothing or the member asks for it (skipFaq).

const bodySchema = z.object({
  chatId: z.string().optional(),
  gameId: z.string().optional(),
  rulebookId: z.string().optional(),
  provider: z.enum(["claude", "free", "own"]).default("claude"),
  question: z.string().trim().min(1).max(4000),
  skipFaq: z.boolean().optional(),
});

const ndjson = (stream: ReadableStream) =>
  new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const FREE_ADDENDUM = `

Rulebook excerpts, when provided, are marked with [Rulebook "title", page N]. Base your answer on them and cite pages in the form (title, p. N). If the excerpts don't contain the answer, say so.`;

/** At most this many rulebooks are read per question (base game, expansions, languages…). */
const MAX_RULEBOOKS = 6;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const mod = await getModule("ai");
  if (!mod.enabled) return Response.json({ error: "disabled" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { question } = parsed.data;

  const status = await getAiStatus(user.id, mod);
  if (status.access === "NONE") return Response.json({ error: "blocked" }, { status: 403 });

  // Load the conversation, or prepare a new one (created only once we answer).
  const include = { game: true, messages: { orderBy: { createdAt: "asc" as const } } };
  let chat = parsed.data.chatId ? await db.aiChat.findFirst({ where: { id: parsed.data.chatId, userId: user.id }, include }) : null;
  let newGameId: string | undefined;
  if (!chat) {
    // New conversations are about a game from the member's own Kallax.
    const game =
      parsed.data.gameId && (await inMemberKallax(user.id, parsed.data.gameId)) ? await db.game.findUnique({ where: { id: parsed.data.gameId } }) : null;
    newGameId = game?.id;
  }
  const gameId = chat?.gameId ?? newGameId;
  // Every PDF rulebook of the game is read, for every question.
  const rulebooks = gameId
    ? await db.rulebook.findMany({ where: { game: { OR: [{ id: gameId }, { baseGameId: gameId }] } }, include: { file: true }, orderBy: { createdAt: "asc" }, take: MAX_RULEBOOKS })
    : [];
  if (!chat && !rulebooks.length && !mod.settings.allowGeneralKnowledge) return Response.json({ error: "rulebookRequired" }, { status: 400 });
  const ensureChat = async () =>
    (chat ??= await db.aiChat.create({ data: { userId: user.id, gameId: newGameId, title: question.slice(0, 80) }, include }));
  const useFaq = Boolean(gameId) && (await faqEnabled(mod));

  // 1. Always the game's FAQ first: same question already answered → instant, free answer.
  if (useFaq && gameId && !parsed.data.skipFaq) {
    const faq = await findFaqMatch(gameId, question, mod);
    if (faq) {
      const conversation = await ensureChat();
      // Older entries don't say which rulebook a page comes from: use the entry's rulebook.
      const citations: Citation[] = (faq.citations ? (JSON.parse(faq.citations) as Citation[]) : [])
        .map((c) => ({ ...c, fileId: c.fileId ?? faq.rulebook?.fileId, title: c.title ?? faq.rulebook?.title }))
        .filter((c) => c.fileId);
      await db.aiMessage.create({ data: { chatId: conversation.id, role: "user", content: question } });
      await db.aiMessage.create({
        data: {
          chatId: conversation.id,
          role: "assistant",
          content: faq.answer,
          citations: citations.length ? JSON.stringify(citations) : null,
          provider: "faq",
          model: faq.id,
        },
      });
      await db.ruleFaq.update({ where: { id: faq.id }, data: { askCount: { increment: 1 } } });
      await db.aiChat.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      const encoder = new TextEncoder();
      return ndjson(
        new ReadableStream({
          start(controller) {
            const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            send({ type: "chat", id: conversation.id });
            send({ type: "provider", provider: "faq", switched: false });
            send({ type: "faq", id: faq.id, question: faq.question, verified: faq.status === "VERIFIED" });
            send({ type: "text", text: faq.answer });
            for (const c of citations) send({ type: "citation", ...c });
            send({ type: "done" });
            controller.close();
          },
        }),
      );
    }
  }

  // 2. Otherwise, the AI.
  const decision = resolveProvider(status, parsed.data.provider, Boolean(mod.settings.autoFallbackToFree));
  if ("error" in decision) return Response.json({ error: decision.error }, { status: 403 });
  const loaded = await ensureChat();

  // "Ask the AI anyway" after a FAQ answer: the question is already in the chat, and the
  // AI shouldn't see the FAQ answer it is asked to replace.
  let history = loaded.messages;
  const [prevQ, prevA] = history.slice(-2);
  const retryAfterFaq = Boolean(parsed.data.skipFaq && prevA?.provider === "faq" && prevQ?.role === "user" && prevQ.content === question);
  if (retryAfterFaq) history = history.slice(0, -2);
  const conversation = { ...loaded, messages: history };
  const firstQuestion = !history.some((m) => m.role === "user");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      send({ type: "chat", id: conversation.id });
      send({ type: "provider", provider: decision.provider, switched: decision.switched, reason: status.claude.reason ?? null, books: rulebooks.length });

      let answer = "";
      const citations: Citation[] = [];
      let usage = { model: "", inputTokens: 0, outputTokens: 0, costUsd: 0 };
      let provider = decision.provider;
      let refused = false;

      const runFree = async () => {
        const s = mod.settings;
        let excerpt = "";
        if (rulebooks.length) {
          const all = (await Promise.all(rulebooks.map(rulebookPages))).flatMap((pages, i) =>
            pages.map((text, p) => ({ title: rulebooks[i].title, page: p + 1, text })),
          );
          excerpt = selectPages(all, question, Number(s.freeMaxContextChars))
            .map((p) => `[Rulebook "${p.title}", page ${p.page}]\n${p.text}`)
            .join("\n\n");
        }
        const books = rulebooks.length ? `\nRulebooks: ${rulebooks.map((r) => r.title).join(", ")}` : "\nNo rulebook attached.";
        const context = conversation.game ? `Game: ${conversation.game.name}${books}` : "No specific game selected.";
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
        if (!retryAfterFaq) await db.aiMessage.create({ data: { chatId: conversation.id, role: "user", content: question } });

        if (provider === "claude" || provider === "own") {
          try {
            // "own": the member's own key and model; the site's key otherwise.
            const own = provider === "own" ? await getOwnKey(user.id) : null;
            if (provider === "own" && !own) throw new OwnKeyError();
            const model = own?.model ?? (String(mod.settings.model) || "claude-opus-5-5");
            const messages = await buildMessages({ ...conversation, rulebooks }, question, { inlinePdfs: Boolean(own) });
            const advanced = supportsEffort(model);
            const client = own ? new Anthropic({ apiKey: own.apiKey }) : getClient();
            const response = client.beta.messages.stream(
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
                // documents are attached in rulebook order, so the index tells which rulebook
                const rb = rulebooks[c.document_index];
                const citation: Citation = { page: c.start_page_number, endPage: c.end_page_number, text: c.cited_text.slice(0, 400), fileId: rb?.fileId, title: rb?.title };
                if (!citations.some((x) => x.page === citation.page && x.text === citation.text && x.fileId === citation.fileId)) {
                  citations.push(citation);
                  send({ type: "citation", ...citation });
                }
              }
            }
            const final = await response.finalMessage();
            if (final.stop_reason === "refusal") {
              refused = true;
              send({ type: "error", code: "refusal" });
            }
            usage = {
              model: final.model,
              inputTokens: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0),
              outputTokens: final.usage.output_tokens,
              costUsd: claudeCostUsd(final.model, final.usage),
            };
          } catch (err) {
            // Claude failed before saying anything (bad key, outage…): let the free option answer.
            const aborted = err instanceof Anthropic.APIUserAbortError;
            // Never fall back from the member's own credits: they chose to pay for this one.
            if (provider === "own" || answer || aborted || !status.free.available || !mod.settings.autoFallbackToFree) throw err;
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
        // Feed the game's FAQ. Only a conversation's opening question stands on its own;
        // follow-ups ("and with 2 players?") depend on what came before.
        if (useFaq && conversation.gameId && firstQuestion && !refused && answer) {
          await recordFaq({ gameId: conversation.gameId, rulebookId: rulebooks.find((r) => r.fileId === citations[0]?.fileId)?.id ?? null, question, answer, citations, provider, countAsk: !retryAfterFaq }).catch((err) =>
            console.error("[ai] FAQ update failed:", err),
          );
        }
        send({ type: "done" });
      } catch (error) {
        let code = "unknown";
        if (provider === "own" && (error instanceof OwnKeyError || error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError))
          code = "ownKeyInvalid";
        else if (provider === "own" && error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) code = "ownKeyCredit";
        else if (error instanceof Anthropic.AuthenticationError) code = "notConfigured";
        else if (error instanceof Anthropic.RateLimitError) code = "busy";
        else if (error instanceof Anthropic.APIError) code = "api";
        else if (error instanceof FreeProviderError) code = error.status === 429 || error.status === 503 ? "freeBusy" : error.status === 502 || error.status === 413 ? "freeIncomplete" : "freeError";
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

  return ndjson(stream);
}

/** The member chose their own credits but their key is gone or can't be read. */
class OwnKeyError extends Error {}

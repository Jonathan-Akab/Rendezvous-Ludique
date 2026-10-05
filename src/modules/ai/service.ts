import "server-only";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";

// Rules assistant powered by Claude. Every PDF rulebook of the game (base rules,
// expansions, other languages…) is uploaded once to the Anthropic Files API and
// attached to every question (with prompt caching), so answers are grounded in the
// actual rules and cite page numbers.

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
export function getClient() {
  client ??= new Anthropic();
  return client;
}

export const SYSTEM_PROMPT = `You are the rules assistant of Rendezvous Ludique, a community website for board game players. Members come to you before or during a game to understand how a game works or to settle a rules question at the table.

When rulebook documents are attached (there can be several: base game, expansions, other languages), they are the authority: base your answers on them and cite the relevant passages. If they disagree, say which document says what. If the rulebooks do not cover the question, say so plainly, then give your best understanding and label it clearly as not coming from the rulebook. If a rulebook seems to be for a different edition or game than the one named, point that out.

When no rulebook is attached, answer from your general knowledge of the game, and mention briefly that editions and expansions can change rules, so the printed rulebook wins in case of doubt. If you do not know the game, say so instead of guessing.

Answer in the language the member writes in. Players are often mid-game, so lead with the direct answer, then the short explanation; use a numbered list for sequences of steps. When asked to explain a whole game, cover the goal, setup highlights, how a turn works, how the game ends and scores, and one or two tips for a first game.`;

/** Gets (or creates) the Files API id of a rulebook. */
async function rulebookFileId(rulebook: { id: string; aiFileId: string | null; file: { storageKey: string; fileName: string } }) {
  if (rulebook.aiFileId) return rulebook.aiFileId;
  const data = await readStored(rulebook.file.storageKey);
  const uploaded = await getClient().files.upload({
    file: await toFile(data, rulebook.file.fileName, { type: "application/pdf" }),
  });
  await db.rulebook.update({ where: { id: rulebook.id }, data: { aiFileId: uploaded.id } });
  return uploaded.id;
}

/** A page citation; `fileId`/`title` say which rulebook it comes from. */
export type Citation = { page: number; endPage: number; text: string; fileId?: string; title?: string };

export type AiRulebook = { id: string; title: string; fileId: string; aiFileId: string | null; file: { storageKey: string; fileName: string } };

/**
 * Builds the conversation for Claude from the chat history plus the new question.
 * `inlinePdfs`: send the PDFs themselves instead of Files API ids — needed with a
 * member's own key, whose account can't see files uploaded with the site's key.
 */
export async function buildMessages(chat: {
  game: { name: string; year: number | null } | null;
  rulebooks: AiRulebook[];
  messages: { role: string; content: string }[];
}, question: string, { inlinePdfs = false } = {}) {
  const turns = [...chat.messages, { role: "user", content: question }];
  const books = chat.rulebooks.length ? `\nAttached rulebooks: ${chat.rulebooks.map((r) => r.title).join(", ")}` : "\nNo rulebook attached.";
  const context = chat.game ? `Game: ${chat.game.name}${chat.game.year ? ` (${chat.game.year})` : ""}${books}` : "No specific game selected.";

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (i === 0) {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      const sources: Anthropic.Beta.BetaRequestDocumentBlock["source"][] = await Promise.all(
        chat.rulebooks.map(async (rb) =>
          inlinePdfs
            ? { type: "base64" as const, media_type: "application/pdf" as const, data: (await readStored(rb.file.storageKey)).toString("base64") }
            : { type: "file" as const, file_id: await rulebookFileId(rb) },
        ),
      );
      chat.rulebooks.forEach((rb, n) => {
        content.push({
          type: "document",
          source: sources[n],
          title: rb.title,
          citations: { enabled: true },
          // the rulebooks are the large, stable prefix of every follow-up question
          ...(n === chat.rulebooks.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
        });
      });
      content.push({ type: "text", text: `${context}\n\n${turn.content}` });
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: turn.content });
    }
  }
  return messages;
}

/** Questions asked by a member in the last 24 hours (for the daily limit). */
export async function questionsToday(userId: string) {
  return db.aiMessage.count({
    where: { role: "user", chat: { userId }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

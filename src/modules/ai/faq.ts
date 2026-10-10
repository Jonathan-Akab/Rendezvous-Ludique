import "server-only";
import { db } from "@/lib/db";
import { getModule, type ModuleState } from "@/lib/modules";
import { coverage, keywords, textSimilarity } from "@/lib/similarity";
import type { Citation } from "./service";

// Rules FAQ: every question asked to the rules AI about a game feeds that game's FAQ.
// Similar questions are grouped (askCount goes up) and, before calling the AI, we look
// for an answer already in the FAQ — it's instant and costs nothing.

/** Same question: answer straight from the FAQ / group with an existing entry. */
export const FAQ_SAME_SCORE = 0.7;
/** Related question: shown when searching the FAQ. */
export const FAQ_RELATED_SCORE = 0.3;

/** Which entries members see: verified ones, plus automatic ones unless admins review first. */
export function visibleFaqWhere(mod: ModuleState) {
  return mod.settings.faqAutoPublish ? { status: { in: ["AUTO", "VERIFIED"] } } : { status: "VERIFIED" };
}

export async function faqEnabled(mod?: ModuleState) {
  const m = mod ?? (await getModule("ai"));
  return m.enabled && Boolean(m.settings.faqEnabled);
}

/** Compares two questions about a game, ignoring the game's own name ("…à Azul?"). */
async function questionComparer(gameId: string) {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { name: true } });
  const ignore = new Set(keywords(game?.name ?? ""));
  const words = (q: string) => keywords(q, ignore);
  return { words, similarity: (a: string, b: string) => textSimilarity(words(a), words(b)) };
}

/** The FAQ entry answering the same question, if there is one. */
export async function findFaqMatch(gameId: string, question: string, mod: ModuleState) {
  const [entries, compare] = await Promise.all([db.ruleFaq.findMany({ where: { gameId, ...visibleFaqWhere(mod) }, include: { rulebook: { select: { fileId: true, title: true } } } }), questionComparer(gameId)]);
  const ranked = entries
    .map((item) => ({ item, score: compare.similarity(question, item.question) }))
    .filter((x) => x.score >= FAQ_SAME_SCORE);
  // Prefer an admin-verified answer when two are as close.
  ranked.sort((a, b) => b.score - a.score || Number(b.item.status === "VERIFIED") - Number(a.item.status === "VERIFIED"));
  return ranked[0]?.item ?? null;
}

/** Searches a game's FAQ: matching words first, then the most asked. */
export async function searchFaq(gameId: string, query: string, mod: ModuleState) {
  const entries = await db.ruleFaq.findMany({
    where: { gameId, ...visibleFaqWhere(mod) },
    include: { rulebook: { select: { title: true, fileId: true } } },
    orderBy: [{ askCount: "desc" }, { updatedAt: "desc" }],
  });
  const q = keywords(query);
  if (!q.length) return entries;
  // Words found in the question count most; words found in the answer help.
  return entries
    .map((e) => ({ e, score: 0.75 * coverage(q, e.question) + 0.25 * coverage(q, e.answer) }))
    .filter((x) => x.score >= FAQ_RELATED_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

/** Visible FAQ entries per game. */
export async function faqCounts(mod: ModuleState, gameIds?: string[]) {
  const rows = await db.ruleFaq.groupBy({
    by: ["gameId"],
    where: { ...visibleFaqWhere(mod), ...(gameIds ? { gameId: { in: gameIds } } : {}) },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.gameId, r._count._all]));
}

const PROVIDER_RANK: Record<string, number> = { free: 1, claude: 2, own: 2, manual: 3 };

/** Adds an answered question to the game's FAQ, or groups it with the same question. */
export async function recordFaq(entry: {
  gameId: string;
  rulebookId: string | null;
  question: string;
  answer: string;
  citations: Citation[];
  provider: string;
  /** false when the member already got this question from the FAQ and asked the AI anyway */
  countAsk?: boolean;
  /** the opening question of a conversation; later ones are kept only when they stand on their own */
  isFirst?: boolean;
}): Promise<{ outcome: "added" | "grouped" | "skipped" }> {
  const compare = await questionComparer(entry.gameId);
  const words = compare.words(entry.question).length;
  // A follow-up ("and with 2 players?") depends on what came before: only keep it when it has enough words of its own.
  if (entry.answer.trim().length < 20 || words === 0 || (entry.isFirst === false && words < 4)) return { outcome: "skipped" };
  const existing = await db.ruleFaq.findMany({ where: { gameId: entry.gameId }, select: { id: true, question: true, status: true, provider: true } });
  const same = existing
    .map((e) => ({ e, score: compare.similarity(entry.question, e.question) }))
    .filter((x) => x.score >= FAQ_SAME_SCORE)
    .sort((a, b) => b.score - a.score)[0]?.e;

  const content = {
    answer: entry.answer,
    citations: entry.citations.length ? JSON.stringify(entry.citations) : null,
    rulebookId: entry.rulebookId,
    provider: entry.provider,
  };
  if (!same) {
    await db.ruleFaq.create({ data: { gameId: entry.gameId, question: entry.question.slice(0, 500), ...content } });
    return { outcome: "added" };
  }
  // Keep admin-reviewed answers; otherwise a more reliable answer (Claude over the free AI) replaces it.
  const upgrade = same.status === "AUTO" && (PROVIDER_RANK[entry.provider] ?? 0) > (PROVIDER_RANK[same.provider ?? ""] ?? 0);
  await db.ruleFaq.update({ where: { id: same.id }, data: { ...(entry.countAsk === false ? {} : { askCount: { increment: 1 } }), ...(upgrade ? content : {}) } });
  return { outcome: "grouped" };
}

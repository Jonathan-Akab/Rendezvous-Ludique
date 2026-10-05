import "server-only";
import { db } from "@/lib/db";
import { rankBySimilarity } from "@/lib/similarity";

/** From this score on, a new suggestion is treated as a duplicate and becomes a vote. */
export const DUPLICATE_SCORE = 0.6;
/** Lower score used to show "already proposed?" hints while the member types. */
export const HINT_SCORE = 0.34;

export type SimilarSuggestion = { id: string; title: string; status: string; votes: number; voted: boolean; score: number };

const fullText = (s: { title: string; details: string | null }) => `${s.title} ${s.details ?? ""}`;

/** Existing suggestions resembling `title` (+ `details`), best first. */
export async function findSimilarSuggestions(userId: string, title: string, details = "", min = HINT_SCORE, limit = 3): Promise<SimilarSuggestion[]> {
  if (title.trim().length < 3) return [];
  const all = await db.suggestion.findMany({
    where: { status: { not: "DECLINED" } },
    select: { id: true, title: true, details: true, status: true, _count: { select: { votes: true } }, votes: { where: { userId }, select: { userId: true } } },
  });
  // A match on the title alone counts, and so does a match on the whole text.
  const byTitle = rankBySimilarity(title, all, (s) => s.title, min);
  const byText = details ? rankBySimilarity(`${title} ${details}`, all, fullText, min) : [];
  const best = new Map<string, { item: (typeof all)[number]; score: number }>();
  for (const r of [...byTitle, ...byText]) if ((best.get(r.item.id)?.score ?? 0) < r.score) best.set(r.item.id, r);
  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score }) => ({ id: item.id, title: item.title, status: item.status, votes: item._count.votes, voted: item.votes.length > 0, score }));
}

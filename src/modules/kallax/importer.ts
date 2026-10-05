import "server-only";
import { db } from "@/lib/db";
import { coverUrl, searchGames } from "@/modules/games/service";

// Matching imported names (from a pasted list or photo recognition) against our
// own game database, so existing games are reused and only new ones get created.

export type CatalogueMatch = { id: string; name: string; year: number | null; cover: string | null; rating: number | null };

export type ImportCandidate = {
  name: string;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMin?: number | null;
  imageUrl?: string | null;
  status?: string;
  confidence?: "high" | "medium" | "low";
  match: CatalogueMatch | null;
  /** close but not exact catalogue names, for the member to pick from */
  suggestions: CatalogueMatch[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function toMatch(g: Awaited<ReturnType<typeof searchGames>>[number]): CatalogueMatch {
  return { id: g.id, name: g.name, year: g.year, cover: coverUrl(g), rating: g.rating.avg };
}

export async function matchCandidate(c: Omit<ImportCandidate, "match" | "suggestions">): Promise<ImportCandidate> {
  const found = await searchGames(c.name, 4);
  const exact = found.find((g) => normalize(g.name) === normalize(c.name));
  if (exact) return { ...c, match: toMatch(exact), suggestions: [] };

  // Typos and misread titles: look up by the start of the name and rank by similarity.
  const key = normalize(c.name);
  const pool = new Map(found.map((g) => [g.id, g]));
  for (const probe of [key.slice(0, 4), key.split(" ")[0]]) {
    if (probe.length >= 3) for (const g of await searchGames(probe, 10)) pool.set(g.id, g);
  }
  const ranked = [...pool.values()]
    .map((g) => ({ g, score: similarity(key, normalize(g.name)) }))
    .filter((x) => x.score >= 0.6 || found.some((f) => f.id === x.g.id))
    .sort((a, b) => b.score - a.score);
  // Nearly identical (e.g. one letter off): treat as the same game.
  const best = ranked[0];
  if (best && best.score >= 0.88) return { ...c, match: toMatch(best.g), suggestions: [] };
  return { ...c, match: null, suggestions: ranked.slice(0, 3).map((x) => toMatch(x.g)) };
}

/** 1 = identical, 0 = nothing in common (Levenshtein distance based). */
function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

export async function matchAll(items: Omit<ImportCandidate, "match" | "suggestions">[]) {
  const out: ImportCandidate[] = [];
  for (const item of items.slice(0, 500)) out.push(await matchCandidate(item));
  return out;
}

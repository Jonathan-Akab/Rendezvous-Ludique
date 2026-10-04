import "server-only";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import type { Prisma } from "@/generated/prisma/client";

// The site's own game database. Every game a member adds becomes a catalogue entry
// that the next member can find and reuse (with its info, cover and rating).

export type RatingStats = { avg: number | null; count: number };

export function coverUrl(game: { coverFileId?: string | null; imageUrl?: string | null }) {
  if (game.coverFileId) return `/files/${game.coverFileId}`;
  return game.imageUrl ?? null;
}

/** Average "meeple rating" per game, from members' own ratings. */
export async function getRatingStats(gameIds: string[]): Promise<Map<string, RatingStats>> {
  const out = new Map<string, RatingStats>();
  if (gameIds.length === 0) return out;
  const groups = await db.gameRating.groupBy({
    by: ["gameId"],
    where: { gameId: { in: gameIds } },
    _avg: { score: true },
    _count: { _all: true },
  });
  for (const g of groups) out.set(g.gameId, { avg: g._avg.score, count: g._count._all });
  return out;
}

export async function getMyRatings(userId: string, gameIds: string[]) {
  const rows = await db.gameRating.findMany({ where: { userId, gameId: { in: gameIds } }, select: { gameId: true, score: true } });
  return new Map(rows.map((r) => [r.gameId, r.score]));
}

const CARD_SELECT = {
  id: true,
  name: true,
  year: true,
  minPlayers: true,
  maxPlayers: true,
  playTimeMin: true,
  weight: true,
  coverFileId: true,
  imageUrl: true,
  designer: true,
  _count: { select: { libraryGames: true, plays: true, rulebooks: true } },
} satisfies Prisma.GameSelect;

export type GameCard = Prisma.GameGetPayload<{ select: typeof CARD_SELECT }> & { rating: RatingStats };

/** Autocomplete lookup used when adding a game anywhere on the site. */
export async function searchGames(q: string, take = 8) {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.game.findMany({ where: { name: ilike(query) }, select: CARD_SELECT, take: 40 });
  // Exact and prefix matches first, then the most owned.
  const lower = query.toLowerCase();
  const rank = (n: string) => (n.toLowerCase() === lower ? 0 : n.toLowerCase().startsWith(lower) ? 1 : 2);
  rows.sort((a, b) => rank(a.name) - rank(b.name) || b._count.libraryGames - a._count.libraryGames || a.name.localeCompare(b.name));
  const top = rows.slice(0, take);
  const stats = await getRatingStats(top.map((g) => g.id));
  return top.map((g) => ({ ...g, rating: stats.get(g.id) ?? { avg: null, count: 0 } }));
}

export type CatalogueSort = "popular" | "rating" | "name" | "recent";

export async function listCatalogue(opts: { q?: string; players?: number; maxTime?: number; sort?: CatalogueSort; take?: number }) {
  const where: Prisma.GameWhereInput = {};
  const and: Prisma.GameWhereInput[] = [];
  if (opts.q) and.push({ OR: [{ name: ilike(opts.q) }, { designer: ilike(opts.q) }, { categories: ilike(opts.q) }] });
  if (opts.players) and.push({ minPlayers: { lte: opts.players } }, { maxPlayers: { gte: opts.players } });
  if (opts.maxTime) and.push({ playTimeMin: { lte: opts.maxTime } });
  if (and.length) where.AND = and;

  const orderBy: Prisma.GameOrderByWithRelationInput =
    opts.sort === "name" ? { name: "asc" } : opts.sort === "recent" ? { createdAt: "desc" } : { libraryGames: { _count: "desc" } };
  const games = await db.game.findMany({ where, select: CARD_SELECT, orderBy, take: opts.take ?? 120 });
  const stats = await getRatingStats(games.map((g) => g.id));
  const withRating: GameCard[] = games.map((g) => ({ ...g, rating: stats.get(g.id) ?? { avg: null, count: 0 } }));
  if (opts.sort === "rating") withRating.sort((a, b) => (b.rating.avg ?? -1) - (a.rating.avg ?? -1) || b.rating.count - a.rating.count);
  return withRating;
}

export async function getGameDetail(id: string) {
  const game = await db.game.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true, displayName: true, meepleColor: true } },
      rulebooks: { include: { file: true, uploadedBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } },
      _count: { select: { libraryGames: true, plays: true, eventGames: true } },
    },
  });
  if (!game) return null;
  const ratings = await db.gameRating.findMany({
    where: { gameId: id },
    include: { user: { select: { username: true, displayName: true, meepleColor: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const distribution = Array.from({ length: 10 }, (_, i) => ratings.filter((r) => r.score === i + 1).length);
  const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null;
  return { game, ratings, rating: { avg, count: ratings.length }, distribution };
}

/** Can this member edit the game's shared info? */
export function canEditGame(game: { createdById: string | null }, user: { id: string; role: string }, communityEditing: boolean) {
  return user.role === "ADMIN" || game.createdById === user.id || communityEditing;
}

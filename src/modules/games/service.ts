import "server-only";
import { db } from "@/lib/db";
import { matchIds } from "@/lib/search";
import type { Prisma } from "@/generated/prisma/client";

// The Ludothèque: the site-wide game reference. It is never edited by members — it
// fills itself: when a game is added to a Kallax, `ensureGame` looks it up by its
// normalised name (or BGG id) and creates it only if it doesn't exist yet.

export type RatingStats = { avg: number | null; count: number };

/** "Les Aventuriers du Rail!" → "les aventuriers du rail" — the duplicate check. */
export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function coverUrl(game: { coverFileId?: string | null; imageUrl?: string | null }) {
  if (game.coverFileId) return `/files/${game.coverFileId}`;
  return game.imageUrl ?? null;
}

export type GameInfo = {
  name: string;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMin?: number | null;
  minAge?: number | null;
  designer?: string | null;
  publisher?: string | null;
  imageUrl?: string | null;
  bggId?: number | null;
  /** Ludothèque-only details */
  weight?: number | null;
  categories?: string | null;
  description?: string | null;
};

export async function findGameByName(name: string) {
  return db.game.findUnique({ where: { normalizedName: normalizeName(name) } });
}

/** Returns the Ludothèque entry for this game, creating it if it doesn't exist (existing entries are left untouched). */
export async function ensureGame(info: GameInfo, userId: string) {
  const normalizedName = normalizeName(info.name);
  if (!normalizedName) throw new Error("Empty game name");
  const existing =
    (info.bggId ? await db.game.findUnique({ where: { bggId: info.bggId } }) : null) ??
    (await db.game.findUnique({ where: { normalizedName } }));
  if (existing) return existing;
  try {
    return await db.game.create({
      data: {
        name: info.name.trim().slice(0, 150),
        normalizedName,
        year: info.year ?? null,
        minPlayers: info.minPlayers ?? null,
        maxPlayers: info.maxPlayers ?? null,
        playTimeMin: info.playTimeMin ?? null,
        minAge: info.minAge ?? null,
        designer: info.designer ?? null,
        publisher: info.publisher ?? null,
        imageUrl: info.imageUrl ?? null,
        bggId: info.bggId ?? null,
        weight: info.weight ?? null,
        categories: info.categories ?? null,
        description: info.description ?? null,
        createdById: userId,
      },
    });
  } catch {
    // Two members added the same new game at the same moment: use the one that won.
    return db.game.findUniqueOrThrow({ where: { normalizedName } });
  }
}

/** Fills the Ludothèque entry's empty fields with what we learned (never overwrites). */
export async function fillEmptyGameFields(gameId: string, info: Partial<GameInfo>) {
  const g = await db.game.findUnique({ where: { id: gameId } });
  if (!g) return;
  const keep = <T>(current: T | null, value: T | null | undefined) => (current == null && value != null ? value : undefined);
  await db.game.update({
    where: { id: gameId },
    data: {
      year: keep(g.year, info.year),
      minPlayers: keep(g.minPlayers, info.minPlayers),
      maxPlayers: keep(g.maxPlayers, info.maxPlayers),
      playTimeMin: keep(g.playTimeMin, info.playTimeMin),
      minAge: keep(g.minAge, info.minAge),
      designer: keep(g.designer, info.designer),
      publisher: keep(g.publisher, info.publisher),
      weight: keep(g.weight, info.weight),
      categories: keep(g.categories, info.categories),
      description: keep(g.description, info.description),
      imageUrl: g.coverFileId ? undefined : keep(g.imageUrl, info.imageUrl),
    },
  });
}

/** Members' average rating per game. */
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
  designer: true,
  coverFileId: true,
  imageUrl: true,
  _count: { select: { kallaxGames: true, plays: true, rulebooks: true } },
} satisfies Prisma.GameSelect;

export type GameCard = Prisma.GameGetPayload<{ select: typeof CARD_SELECT }> & { rating: RatingStats };

/** Ludothèque lookup — used to make adding a game to a Kallax quick (autocomplete). */
export async function searchGames(q: string, take = 8) {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.game.findMany({ where: { id: { in: await matchIds("Game", ["name", "normalizedName"], query) } }, select: CARD_SELECT, take: 40 });
  const lower = normalizeName(query);
  const rank = (n: string) => (normalizeName(n) === lower ? 0 : normalizeName(n).startsWith(lower) ? 1 : 2);
  rows.sort((a, b) => rank(a.name) - rank(b.name) || b._count.kallaxGames - a._count.kallaxGames || a.name.localeCompare(b.name));
  const top = rows.slice(0, take);
  const stats = await getRatingStats(top.map((g) => g.id));
  return top.map((g) => ({ ...g, rating: stats.get(g.id) ?? { avg: null, count: 0 } }));
}

export type CatalogueSort = "popular" | "rating" | "name" | "recent";

export async function listCatalogue(opts: { q?: string; players?: number; maxTime?: number; sort?: CatalogueSort; take?: number }) {
  const and: Prisma.GameWhereInput[] = [];
  if (opts.q) and.push({ id: { in: await matchIds("Game", ["name", "designer", "publisher"], opts.q) } });
  if (opts.players) and.push({ minPlayers: { lte: opts.players } }, { maxPlayers: { gte: opts.players } });
  if (opts.maxTime) and.push({ playTimeMin: { lte: opts.maxTime } });

  const orderBy: Prisma.GameOrderByWithRelationInput =
    opts.sort === "name" ? { name: "asc" } : opts.sort === "recent" ? { createdAt: "desc" } : { kallaxGames: { _count: "desc" } };
  and.push({ baseGameId: null }); // expansions are listed on their base game's page
  const games = await db.game.findMany({ where: { AND: and }, select: CARD_SELECT, orderBy, take: opts.take ?? 200 });
  const stats = await getRatingStats(games.map((g) => g.id));
  const withRating: GameCard[] = games.map((g) => ({ ...g, rating: stats.get(g.id) ?? { avg: null, count: 0 } }));
  if (opts.sort === "rating") withRating.sort((a, b) => (b.rating.avg ?? -1) - (a.rating.avg ?? -1) || b.rating.count - a.rating.count);
  return withRating;
}

export async function getGameDetail(id: string) {
  const game = await db.game.findUnique({
    where: { id },
    include: {
      rulebooks: { include: { file: true, uploadedBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } },
      _count: { select: { kallaxGames: true, plays: true } },
      baseGame: { select: { id: true, name: true } },
      expansions: { select: { id: true, name: true, coverFileId: true, imageUrl: true }, orderBy: { name: "asc" } },
    },
  });
  if (!game) return null;
  const scores = await db.gameRating.findMany({ where: { gameId: id }, select: { score: true } });
  const distribution = Array.from({ length: 10 }, (_, i) => scores.filter((r) => r.score === i + 1).length);
  const avg = scores.length ? scores.reduce((s, r) => s + r.score, 0) / scores.length : null;
  return { game, rating: { avg, count: scores.length }, distribution };
}

/** Does this member have the game in one of their Kallax (their own or shared with them)? */
export async function inMemberKallax(userId: string, gameId: string) {
  return db.kallaxGame.findFirst({
    where: { gameId, library: { members: { some: { userId, status: "ACCEPTED" } } } },
    select: { id: true, libraryId: true },
  });
}

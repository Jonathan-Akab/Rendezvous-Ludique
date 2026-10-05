import "server-only";
import { db } from "@/lib/db";
import { kallaxCoverUrl } from "@/modules/kallax/service";
import { classifyGame, levelOf, type GameType, type Level } from "./gameTypes";

/** A game of the member's Kallax with what the "which game?" filters need. */
export type PickerGame = {
  gameId: string;
  name: string;
  cover: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  minAge: number | null;
  /** complexity 1–5 and its band */
  weight: number | null;
  level: Level | null;
  types: GameType[];
  /** confirmed plays of the member */
  playCount: number;
  /** the member owns at least one expansion of it */
  hasExpansions: boolean;
  /** physically the member's copy (vs. a shared Kallax) */
  mine: boolean;
  /** last confirmed play of the member (ISO), null = never played */
  lastPlayed: string | null;
  /** the member's own rating, else the members' average (1–10) */
  rating: number | null;
};

/** Games the member can actually put on the table: their Kallax, without wishlist / preorders. */
export async function getPickerGames(userId: string): Promise<PickerGame[]> {
  const rows = await db.kallaxGame.findMany({
    where: { library: { members: { some: { userId, status: "ACCEPTED" } } }, parentId: null, status: { in: ["OWNED", "FOR_TRADE"] } },
    include: {
      game: { select: { coverFileId: true, imageUrl: true, minPlayers: true, maxPlayers: true, playTimeMin: true, minAge: true, weight: true, categories: true, description: true } },
      _count: { select: { expansions: true } },
    },
    orderBy: { name: "asc" },
  });
  // one entry per game; "mine" and expansions from any of its copies
  const byGame = new Map<string, (typeof rows)[number]>();
  const mineIds = new Set<string>();
  const withExp = new Set<string>();
  for (const r of rows) {
    if (!byGame.has(r.gameId)) byGame.set(r.gameId, r);
    if ((r.ownerId ?? r.addedById) === userId) mineIds.add(r.gameId);
    if (r._count.expansions > 0) withExp.add(r.gameId);
  }
  const games = [...byGame.values()];
  const ids = games.map((g) => g.gameId);

  const [plays, mine, avg] = await Promise.all([
    db.play.groupBy({ by: ["gameId"], where: { gameId: { in: ids }, participants: { some: { userId, status: "CONFIRMED" } } }, _max: { playedAt: true }, _count: { _all: true } }),
    db.gameRating.findMany({ where: { userId, gameId: { in: ids } }, select: { gameId: true, score: true } }),
    db.gameRating.groupBy({ by: ["gameId"], where: { gameId: { in: ids } }, _avg: { score: true } }),
  ]);
  const last = new Map(plays.map((p) => [p.gameId, p._max.playedAt]));
  const counts = new Map(plays.map((p) => [p.gameId, p._count._all]));
  const myRating = new Map(mine.map((r) => [r.gameId, r.score]));
  const avgRating = new Map(avg.map((r) => [r.gameId, r._avg.score]));

  return games.map((g) => {
    const info = {
      name: g.name,
      categories: g.game.categories,
      description: g.game.description,
      minPlayers: g.minPlayers ?? g.game.minPlayers,
      maxPlayers: g.maxPlayers ?? g.game.maxPlayers,
      playTimeMin: g.playTimeMin ?? g.game.playTimeMin,
      minAge: g.minAge ?? g.game.minAge,
      weight: g.game.weight,
    };
    return {
      gameId: g.gameId,
      name: g.name,
      cover: kallaxCoverUrl(g),
      minPlayers: info.minPlayers,
      maxPlayers: info.maxPlayers,
      playTimeMin: info.playTimeMin,
      minAge: info.minAge,
      weight: info.weight,
      level: levelOf(info.weight),
      types: classifyGame(info),
      // logged plays + the ones typed in on the Kallax
      playCount: (counts.get(g.gameId) ?? 0) + g.extraPlays,
      hasExpansions: withExp.has(g.gameId),
      mine: mineIds.has(g.gameId),
      lastPlayed: last.get(g.gameId)?.toISOString() ?? null,
      rating: myRating.get(g.gameId) ?? (avgRating.get(g.gameId) != null ? Math.round(avgRating.get(g.gameId)! * 10) / 10 : null),
    };
  });
}

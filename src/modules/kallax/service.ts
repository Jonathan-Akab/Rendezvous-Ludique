import "server-only";
import { db } from "@/lib/db";
import { ensureGame, normalizeName, type GameInfo } from "@/modules/games/service";
import { textSimilarity } from "@/lib/similarity";
import { areFriends } from "@/modules/friends/service";

/** Every member starts with their own Kallax. */
export async function createPersonalLibrary(userId: string, displayName: string) {
  return db.library.create({
    data: {
      name: `Kallax — ${displayName}`,
      members: { create: { userId, role: "OWNER", status: "ACCEPTED" } },
    },
  });
}

/** Kallax the member owns or accepted to share. */
export async function getMyLibraries(userId: string) {
  return db.library.findMany({
    where: { members: { some: { userId, status: "ACCEPTED" } } },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, displayName: true, meepleColor: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { games: { where: { parentId: null } } } }, // expansions aren't games of their own
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Who besides its members may look at a Kallax (read-only). */
export const LIBRARY_VISIBILITIES = ["PRIVATE", "FRIENDS", "MEMBERS"] as const;

/** The Kallax of `ownerId` that `viewerId` may look at: shared with the viewer, or visible to friends / to every member. */
export async function getVisibleLibraries(ownerId: string, viewerId: string) {
  const friends = ownerId === viewerId ? false : await areFriends(ownerId, viewerId);
  return db.library.findMany({
    where: {
      members: { some: { userId: ownerId, role: "OWNER", status: "ACCEPTED" } },
      OR: [
        { visibility: "MEMBERS" },
        ...(friends ? [{ visibility: "FRIENDS" }] : []),
        { members: { some: { userId: viewerId, status: "ACCEPTED" } } },
      ],
    },
    include: { _count: { select: { games: { where: { parentId: null } } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function isLibraryMember(libraryId: string, userId: string) {
  const m = await db.libraryMember.findUnique({ where: { libraryId_userId: { libraryId, userId } } });
  return m?.status === "ACCEPTED" ? m : null;
}

/** Picture of a Kallax record: its own photo, its own link, then the Ludothèque's. */
export function kallaxCoverUrl(kg: { coverFileId: string | null; imageUrl: string | null; game?: { coverFileId: string | null; imageUrl: string | null } | null }) {
  if (kg.coverFileId) return `/files/${kg.coverFileId}`;
  if (kg.imageUrl) return kg.imageUrl;
  if (kg.game?.coverFileId) return `/files/${kg.game.coverFileId}`;
  return kg.game?.imageUrl ?? null;
}

export type MyGame = { gameId: string; name: string; cover: string | null };

/**
 * The games in the member's Kallax (all the Kallax they share), one per Ludothèque game.
 * Other modules (plays, events, AI, bazar) let members pick only from this list.
 */
/** The member's games for pickers (plays, events, AI, bazar) — expansions are part of their base game. */
export async function getMyKallaxGames(userId: string): Promise<MyGame[]> {
  const rows = await db.kallaxGame.findMany({
    where: { library: { members: { some: { userId, status: "ACCEPTED" } } }, parentId: null },
    include: { game: { select: { coverFileId: true, imageUrl: true } } },
    orderBy: { name: "asc" },
  });
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.gameId) ? false : (seen.add(r.gameId), true)))
    .map((r) => ({ gameId: r.gameId, name: r.name, cover: kallaxCoverUrl(r) }));
}

/**
 * Plays logged on the site for games of a Kallax: confirmed plays of any member sharing it,
 * by Ludothèque game id. The counter shown on a game adds its `extraPlays` (plays typed in by hand).
 */
export async function getLoggedPlayCounts(libraryId: string, gameIds: string[]) {
  if (!gameIds.length) return new Map<string, number>();
  const members = await db.libraryMember.findMany({ where: { libraryId, status: "ACCEPTED" }, select: { userId: true } });
  const rows = await db.play.groupBy({
    by: ["gameId"],
    where: { gameId: { in: gameIds }, participants: { some: { userId: { in: members.map((m) => m.userId) }, status: "CONFIRMED" } } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.gameId, r._count._all]));
}

/** "Played N times" typed by the member: what isn't logged on the site is kept as extra plays. */
export function extraPlaysFor(total: number | null, logged: number) {
  if (total == null || !Number.isFinite(total)) return null;
  return Math.max(0, Math.min(100_000, Math.round(total)) - logged);
}

export type MyExpansions = Record<string, { gameId: string; name: string }[]>;

/** Expansions in the member's Kallax, grouped by the Ludothèque id of their base game. */
export async function getMyExpansions(userId: string): Promise<MyExpansions> {
  const rows = await db.kallaxGame.findMany({
    where: { library: { members: { some: { userId, status: "ACCEPTED" } } }, parentId: { not: null } },
    select: { gameId: true, name: true, parent: { select: { gameId: true } } },
    orderBy: { name: "asc" },
  });
  const out: MyExpansions = {};
  for (const r of rows) {
    if (!r.parent) continue;
    const list = (out[r.parent.gameId] ??= []);
    if (!list.some((x) => x.gameId === r.gameId)) list.push({ gameId: r.gameId, name: r.name });
  }
  return out;
}

/**
 * Adds a game to a Kallax: makes sure the Ludothèque knows the game (creating it only if
 * it doesn't exist), then stores the Kallax's own record. Returns null if it's already there.
 */
export async function addToKallax(
  libraryId: string,
  info: GameInfo,
  opts: { userId: string; ownerId?: string; status?: string; notes?: string | null; coverFileId?: string | null; gameId?: string; parentId?: string | null },
) {
  const game = opts.gameId ? await db.game.findUnique({ where: { id: opts.gameId } }) : await ensureGame(info, opts.userId);
  if (!game) return null;
  const exists = await db.kallaxGame.findUnique({ where: { libraryId_gameId: { libraryId, gameId: game.id } } });
  if (exists) return { game, kallaxGame: exists, created: false };
  const kallaxGame = await db.kallaxGame.create({
    data: {
      libraryId,
      gameId: game.id,
      addedById: opts.userId,
      ownerId: opts.ownerId ?? opts.userId,
      // The Kallax keeps its own copy of the details, starting from what the member entered
      // (or the Ludothèque's when they picked an existing game).
      name: info.name?.trim() || game.name,
      year: info.year ?? game.year,
      minPlayers: info.minPlayers ?? game.minPlayers,
      maxPlayers: info.maxPlayers ?? game.maxPlayers,
      playTimeMin: info.playTimeMin ?? game.playTimeMin,
      minAge: info.minAge ?? game.minAge,
      designer: info.designer ?? game.designer,
      publisher: info.publisher ?? game.publisher,
      imageUrl: info.imageUrl ?? null,
      coverFileId: opts.coverFileId ?? null,
      status: opts.status ?? "OWNED",
      notes: opts.notes ?? null,
    },
  });
  if (opts.parentId) await attachExpansion(kallaxGame.id, opts.parentId);
  return { game, kallaxGame, created: true };
}

// ───────────── Expansions ─────────────
// An expansion is attached to its base game's Kallax record: it shows under that game and
// doesn't count as a game of its own. The Ludothèque remembers the link too (baseGameId).

/** The base game's record in this Kallax, found by name (for "expansion of X"). */
export async function findBaseInLibrary(libraryId: string, baseName: string, excludeId?: string) {
  const candidates = await db.kallaxGame.findMany({ where: { libraryId, parentId: null, id: excludeId ? { not: excludeId } : undefined }, select: { id: true, name: true } });
  const key = normalizeName(baseName);
  const looksLikeExpansion = (name: string) => /\b(extension|expansion|exp\.?|add-?on|module)\b/i.test(name);
  return (
    candidates.find((c) => normalizeName(c.name) === key) ??
    candidates
      .map((c) => ({ c, score: textSimilarity(c.name, baseName) }))
      .filter((x) => x.score >= 0.8)
      .sort((a, b) => b.score - a.score)[0]?.c ??
    // An edition of the base game ("Clinic" → "Clinic: Deluxe Edition"): the shortest such name.
    candidates
      .filter((c) => normalizeName(c.name).startsWith(`${key} `) && !looksLikeExpansion(c.name))
      .sort((a, b) => a.name.length - b.name.length)[0] ??
    null
  );
}

/** Attaches an expansion to its base game (same Kallax). Returns false if it can't be. */
export async function attachExpansion(expansionId: string, baseId: string) {
  if (expansionId === baseId) return false;
  const [exp, base] = await Promise.all([
    db.kallaxGame.findUnique({ where: { id: expansionId } }),
    db.kallaxGame.findUnique({ where: { id: baseId } }),
  ]);
  if (!exp || !base || exp.libraryId !== base.libraryId) return false;
  // Always attach to a base game, never to another expansion.
  const parentId = base.parentId ?? base.id;
  if (parentId === exp.id) return false;
  const parentGameId = parentId === base.id ? base.gameId : (await db.kallaxGame.findUnique({ where: { id: parentId }, select: { gameId: true } }))?.gameId;
  await db.$transaction([
    // its own "expansions" move up to the base game
    db.kallaxGame.updateMany({ where: { parentId: exp.id }, data: { parentId } }),
    db.kallaxGame.update({ where: { id: exp.id }, data: { parentId } }),
    db.game.updateMany({ where: { id: exp.gameId, baseGameId: null, NOT: { id: parentGameId } }, data: { baseGameId: parentGameId } }),
  ]);
  return true;
}

export async function detachExpansion(expansionId: string) {
  await db.kallaxGame.update({ where: { id: expansionId }, data: { parentId: null } });
}

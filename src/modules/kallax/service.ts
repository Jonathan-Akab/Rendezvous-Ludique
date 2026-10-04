import "server-only";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";

/** Every member starts with their own kallax (library) that they own. */
export async function createPersonalLibrary(userId: string, displayName: string) {
  return db.library.create({
    data: {
      name: `Kallax — ${displayName}`,
      members: { create: { userId, role: "OWNER", status: "ACCEPTED" } },
    },
  });
}

/** Libraries the member has accepted to share. */
export async function getMyLibraries(userId: string) {
  return db.library.findMany({
    where: { members: { some: { userId, status: "ACCEPTED" } } },
    include: {
      members: {
        include: { user: { select: { id: true, username: true, displayName: true, meepleColor: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { games: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function isLibraryMember(libraryId: string, userId: string) {
  const m = await db.libraryMember.findUnique({ where: { libraryId_userId: { libraryId, userId } } });
  return m?.status === "ACCEPTED" ? m : null;
}

/** Find a catalogue game by name (case-insensitive) or create it. */
export async function findOrCreateGame(
  name: string,
  createdById: string,
  extra: { year?: number | null; minPlayers?: number | null; maxPlayers?: number | null; playTimeMin?: number | null } = {},
) {
  const clean = name.trim();
  const all = await db.game.findMany({ where: { name: ilike(clean) }, take: 50 });
  const existing = all.find((g) => g.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  return db.game.create({ data: { name: clean, createdById, ...extra } });
}

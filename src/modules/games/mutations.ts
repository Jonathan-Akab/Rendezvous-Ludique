import "server-only";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { saveUpload } from "@/lib/storage";
import { optFloat, optInt, optStr, str } from "@/lib/forms";

// Internal helpers shared by server actions (not actions themselves, so they can't be
// called from the browser).

/** Shared game fields read from a form (fields prefixed with `game.` take priority). */
export function readGameFields(fd: FormData) {
  const pick = (k: string) => (fd.has(`game.${k}`) ? `game.${k}` : k);
  const imageUrl = str(fd, pick("imageUrl"));
  return {
    name: str(fd, pick("name")).slice(0, 150),
    year: optInt(fd, pick("year")),
    minPlayers: optInt(fd, pick("minPlayers")),
    maxPlayers: optInt(fd, pick("maxPlayers")),
    playTimeMin: optInt(fd, pick("playTimeMin")),
    minAge: optInt(fd, pick("minAge")),
    weight: optFloat(fd, pick("weight")),
    designer: optStr(fd, pick("designer"))?.slice(0, 150) ?? null,
    publisher: optStr(fd, pick("publisher"))?.slice(0, 150) ?? null,
    categories: optStr(fd, pick("categories"))?.slice(0, 300) ?? null,
    imageUrl: /^https:\/\//i.test(imageUrl) ? imageUrl.slice(0, 500) : null,
    description: optStr(fd, pick("description"))?.slice(0, 4000) ?? null,
  };
}

/** Stores an optional uploaded cover (`cover` field); returns its file id. */
export async function storeCoverFromForm(fd: FormData, userId: string) {
  const file = fd.get("cover");
  if (!(file instanceof File) || file.size === 0) return null;
  return (await saveUpload(file, "COVER", userId)).id;
}

export async function findGameByName(name: string) {
  const clean = name.trim();
  const candidates = await db.game.findMany({ where: { name: ilike(clean) }, take: 50 });
  return candidates.find((g) => g.name.toLowerCase() === clean.toLowerCase()) ?? null;
}

/** Creates a catalogue game from form fields, or returns the existing game with that name. */
export async function createGameRecord(fd: FormData, userId: string) {
  const fields = readGameFields(fd);
  const existing = await findGameByName(fields.name);
  if (existing) return existing;
  const coverFileId = await storeCoverFromForm(fd, userId);
  return db.game.create({ data: { ...fields, coverFileId, createdById: userId } });
}

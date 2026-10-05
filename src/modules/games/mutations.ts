import "server-only";
import { saveUpload } from "@/lib/storage";
import { optInt, optStr, str } from "@/lib/forms";

// Helpers shared by server actions (not actions themselves, so they can't be called
// from the browser).

/** Game details read from a form (fields prefixed with `game.` take priority). */
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
    designer: optStr(fd, pick("designer"))?.slice(0, 150) ?? null,
    publisher: optStr(fd, pick("publisher"))?.slice(0, 150) ?? null,
    imageUrl: /^https:\/\//i.test(imageUrl) ? imageUrl.slice(0, 1000) : null,
  };
}

/** Stores an optional uploaded box photo (`cover` field); returns its file id. */
export async function storeCoverFromForm(fd: FormData, userId: string) {
  const file = fd.get("cover");
  if (!(file instanceof File) || file.size === 0) return null;
  return (await saveUpload(file, "COVER", userId)).id;
}

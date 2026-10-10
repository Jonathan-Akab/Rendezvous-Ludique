import "server-only";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "@/lib/db";
import { deleteStored, readStored, saveUpload } from "@/lib/storage";
import { rulebookPages } from "@/modules/ai/free";

// Adding a rulebook to a Ludothèque game: the title is built from the game name and the
// language ("Azul (FR)", then "Azul (FR) #2"…), and a PDF that is the same as one already
// attached — the same file, or almost the same text — is not added a second time.

const SIMILAR = 0.85; // share of 3-word sequences in common above which two rulebooks are "the same"

const shingles = (pages: string[]) => {
  const words = pages.join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{2,}/g) ?? [];
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length && out.size < 60000; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
};

const similarity = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return common / Math.min(a.size, b.size);
};

async function pdfPages(data: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

/** "Azul (FR)", or "Azul (FR) #2", "#3"… when that title is already taken for the game. */
async function freeTitle(gameId: string, gameName: string, language: string) {
  const base = `${gameName} (${language.toUpperCase()})`;
  const taken = new Set((await db.rulebook.findMany({ where: { gameId }, select: { title: true } })).map((r) => r.title));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} #${n}`)) return `${base} #${n}`;
}

/**
 * Stores the PDF and attaches it to the game. Returns `{ added: false }` (and keeps nothing)
 * when an equivalent rulebook is already there. Throws UploadError for a bad file.
 */
export async function addRulebook(opts: { game: { id: string; name: string }; file: File; userId: string; language: string; title?: string }) {
  const { game, file, userId, language } = opts;
  const stored = await saveUpload(file, "RULEBOOK", userId);
  const existing = await db.rulebook.findMany({ where: { gameId: game.id }, include: { file: true } });

  if (existing.length) {
    try {
      const data = await readStored(stored.storageKey);
      const hash = createHash("sha256").update(data).digest("hex");
      let similar = false;
      for (const rb of existing) if (createHash("sha256").update(await readStored(rb.file.storageKey)).digest("hex") === hash) similar = true;
      if (!similar) {
        const mine = shingles(await pdfPages(data));
        if (mine.size >= 50) for (const rb of existing) if (similarity(mine, shingles(await rulebookPages(rb))) >= SIMILAR) similar = true;
      }
      if (similar) {
        await deleteStored(stored.id);
        return { added: false as const };
      }
    } catch (e) {
      // Can't read the PDF's text (scan, odd encoding): keep it rather than lose it.
      console.error("[rulebooks] similarity check failed:", e);
    }
  }

  await db.rulebook.create({
    data: {
      gameId: game.id,
      fileId: stored.id,
      uploadedById: userId,
      title: opts.title || (await freeTitle(game.id, game.name, language)),
      language,
    },
  });
  return { added: true as const };
}

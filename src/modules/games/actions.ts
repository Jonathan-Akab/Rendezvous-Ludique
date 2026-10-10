"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { audit } from "@/lib/audit";
import { deleteStored, saveUpload, UploadError } from "@/lib/storage";
import { oneOf, str, type ActionState } from "@/lib/forms";
import { LOCALES } from "@/lib/constants";
import { ensureGame, findGameByName, inMemberKallax } from "./service";
import { addRulebook } from "./rulebooks";

const refreshGame = (gameId: string) => {
  revalidatePath("/kallax", "layout");
  revalidatePath("/games", "layout");
  revalidatePath(`/games/${gameId}`);
};

/** Rate a game from your Kallax, 1–10 (0 removes the rating). */
export async function rateGameAction(gameId: string, score: number) {
  const user = await requireUser();
  if (!(await inMemberKallax(user.id, gameId))) return;
  if (score === 0) {
    await db.gameRating.deleteMany({ where: { gameId, userId: user.id } });
  } else {
    const s = Math.max(1, Math.min(10, Math.round(score)));
    await db.gameRating.upsert({
      where: { gameId_userId: { gameId, userId: user.id } },
      create: { gameId, userId: user.id, score: s },
      update: { score: s },
    });
  }
  refreshGame(gameId);
}

/** Rulebooks belong to the Ludothèque game, so everyone with that game can use them. */
export async function uploadRulebookAction(gameId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const mod = await getModule("games");
  const t = await getTranslations("games.errors");
  if (!mod.settings.allowRulebookUploads && user.role !== "ADMIN") return { error: t("rulebooksLocked") };
  const game = await db.game.findUnique({ where: { id: gameId }, select: { id: true, name: true } });
  if (!game) return { error: t("notInKallax") };
  const file = fd.get("file");
  if (!(file instanceof File)) return { error: t("upload.empty") };
  let added: boolean;
  try {
    ({ added } = await addRulebook({ game, file, userId: user.id, language: oneOf(str(fd, "language"), LOCALES, "fr"), title: str(fd, "title").slice(0, 120) || undefined }));
  } catch (e) {
    if (e instanceof UploadError) return { error: t(`upload.${e.code}`) };
    throw e;
  }
  refreshGame(gameId);
  // Uploaded from the AI assistant: back to the chat, which reads every rulebook of the game.
  if (str(fd, "then") === "ai") redirect(`/ai?game=${gameId}${added ? "" : "&known=1"}`);
  return { ok: true, message: t(added ? "rulebookAdded" : "rulebookSimilar") };
}

/**
 * Upload from the rules AI with only a game name and a language: reuse the Ludothèque entry
 * if it exists, otherwise create it, then attach the rulebook (unless a similar one is there).
 */
export async function uploadRulebookByNameAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const mod = await getModule("games");
  const t = await getTranslations("games.errors");
  if (!mod.settings.allowRulebookUploads && user.role !== "ADMIN") return { error: t("rulebooksLocked") };
  const name = str(fd, "name").slice(0, 150);
  const file = fd.get("file");
  if (!name || !(file instanceof File) || file.size === 0) return { error: t("upload.empty") };

  const existing = await findGameByName(name);
  let gameId: string;
  let added: boolean;
  try {
    const game = existing ?? (await ensureGame({ name }, user.id));
    gameId = game.id;
    ({ added } = await addRulebook({ game, file, userId: user.id, language: oneOf(str(fd, "language"), LOCALES, "fr") }));
  } catch (e) {
    if (e instanceof UploadError) return { error: t(`upload.${e.code}`) };
    throw e;
  }
  refreshGame(gameId);
  redirect(`/ai?game=${gameId}${added ? "" : "&known=1"}`);
}

export async function deleteRulebookAction(rulebookId: string) {
  const user = await requireUser();
  const rb = await db.rulebook.findUnique({ where: { id: rulebookId } });
  if (!rb || (rb.uploadedById !== user.id && user.role !== "ADMIN")) return;
  await deleteStored(rb.fileId); // cascades to the rulebook
  if (rb.uploadedById !== user.id) await audit(user.id, "rulebook.delete", rb.title);
  refreshGame(rb.gameId);
}

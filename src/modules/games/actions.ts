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
import { inMemberKallax } from "./service";

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
  if (!(await inMemberKallax(user.id, gameId)) && user.role !== "ADMIN") return { error: t("notInKallax") };
  const file = fd.get("file");
  if (!(file instanceof File)) return { error: t("upload.empty") };
  try {
    const stored = await saveUpload(file, "RULEBOOK", user.id);
    await db.rulebook.create({
      data: {
        gameId,
        fileId: stored.id,
        uploadedById: user.id,
        title: str(fd, "title").slice(0, 120) || file.name.replace(/\.pdf$/i, ""),
        language: oneOf(str(fd, "language"), LOCALES, "fr"),
      },
    });
  } catch (e) {
    if (e instanceof UploadError) return { error: t(`upload.${e.code}`) };
    throw e;
  }
  refreshGame(gameId);
  // Uploaded from the AI assistant: back to the chat, which reads every rulebook of the game.
  if (str(fd, "then") === "ai") redirect(`/ai?game=${gameId}`);
  return { ok: true, message: t("rulebookAdded") };
}

export async function deleteRulebookAction(rulebookId: string) {
  const user = await requireUser();
  const rb = await db.rulebook.findUnique({ where: { id: rulebookId } });
  if (!rb || (rb.uploadedById !== user.id && user.role !== "ADMIN")) return;
  await deleteStored(rb.fileId); // cascades to the rulebook
  if (rb.uploadedById !== user.id) await audit(user.id, "rulebook.delete", rb.title);
  refreshGame(rb.gameId);
}

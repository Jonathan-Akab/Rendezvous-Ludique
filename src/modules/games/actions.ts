"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { audit } from "@/lib/audit";
import { deleteStored, saveUpload, UploadError } from "@/lib/storage";
import { createGameRecord, readGameFields, storeCoverFromForm } from "./mutations";
import { oneOf, optStr, str, type ActionState } from "@/lib/forms";
import { LOCALES } from "@/lib/constants";
import { canEditGame } from "./service";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("games");
  return { user, mod };
}

/** Upload error → translated message. */
async function uploadMessage(e: unknown) {
  const t = await getTranslations("games.errors");
  if (e instanceof UploadError) return t(`upload.${e.code}`);
  throw e;
}

export async function createGameAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("games.errors");
  if (!mod.enabled) return { error: t("disabled") };
  if (!mod.settings.membersCanAddGames && user.role !== "ADMIN") return { error: t("addLocked") };
  if (!str(fd, "name")) return { error: t("name") };
  let id: string;
  try {
    id = (await createGameRecord(fd, user.id)).id;
  } catch (e) {
    return { error: await uploadMessage(e) };
  }
  revalidatePath("/games");
  redirect(str(fd, "returnTo") === "ai" ? `/ai?game=${id}` : `/games/${id}`);
}

export async function updateGameAction(gameId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("games.errors");
  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) return { error: t("notFound") };
  if (!canEditGame(game, user, Boolean(mod.settings.communityEditing))) return { error: t("forbidden") };
  const fields = readGameFields(fd);
  if (!fields.name) return { error: t("name") };

  let coverFileId = game.coverFileId;
  if (mod.settings.allowCoverUploads || user.role === "ADMIN") {
    try {
      const uploaded = await storeCoverFromForm(fd, user.id);
      if (uploaded) {
        if (game.coverFileId) await deleteStored(game.coverFileId);
        coverFileId = uploaded;
      }
    } catch (e) {
      return { error: await uploadMessage(e) };
    }
  }
  if (fd.get("removeCover") === "on" && game.coverFileId) {
    await deleteStored(game.coverFileId);
    coverFileId = null;
  }
  await db.game.update({ where: { id: gameId }, data: { ...fields, coverFileId } });
  if (game.createdById !== user.id) await audit(user.id, "game.edit", game.name);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/kallax");
  return { ok: true, message: t("saved") };
}

/** Rate a game 1–10 (0 removes the rating). */
export async function rateGameAction(gameId: string, score: number) {
  const user = await requireUser();
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
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/kallax");
  revalidatePath("/games");
}

export async function saveReviewAction(gameId: string, fd: FormData) {
  const user = await requireUser();
  const review = optStr(fd, "review")?.slice(0, 2000) ?? null;
  await db.gameRating.updateMany({ where: { gameId, userId: user.id }, data: { review } });
  revalidatePath(`/games/${gameId}`);
}

export async function uploadRulebookAction(gameId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("games.errors");
  if (!mod.settings.allowRulebookUploads && user.role !== "ADMIN") return { error: t("rulebooksLocked") };
  const file = fd.get("file");
  if (!(file instanceof File)) return { error: t("upload.empty") };
  let rulebookId: string;
  try {
    const stored = await saveUpload(file, "RULEBOOK", user.id);
    const rulebook = await db.rulebook.create({
      data: {
        gameId,
        fileId: stored.id,
        uploadedById: user.id,
        title: str(fd, "title").slice(0, 120) || file.name.replace(/\.pdf$/i, ""),
        language: oneOf(str(fd, "language"), LOCALES, "fr"),
      },
    });
    rulebookId = rulebook.id;
  } catch (e) {
    return { error: await uploadMessage(e) };
  }
  revalidatePath(`/games/${gameId}`);
  // Uploaded from the AI assistant: go straight to asking questions about it.
  if (str(fd, "then") === "ai") redirect(`/ai?game=${gameId}&rulebook=${rulebookId}`);
  return { ok: true, message: t("rulebookAdded") };
}

export async function deleteRulebookAction(rulebookId: string) {
  const user = await requireUser();
  const rb = await db.rulebook.findUnique({ where: { id: rulebookId } });
  if (!rb || (rb.uploadedById !== user.id && user.role !== "ADMIN")) return;
  await deleteStored(rb.fileId); // cascades to the rulebook
  if (rb.uploadedById !== user.id) await audit(user.id, "rulebook.delete", rb.title);
  revalidatePath(`/games/${rb.gameId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { bool, oneOf, optStr, str, type ActionState } from "@/lib/forms";
import { SUGGESTION_STATUSES } from "@/lib/constants";
import { DUPLICATE_SCORE, findSimilarSuggestions, type SimilarSuggestion } from "./service";
import { notify } from "@/modules/notifications/emails";

const refresh = () => {
  revalidatePath("/suggestions");
  revalidatePath("/admin/suggestions");
};

/** "Already proposed?" hints shown in the suggestion box while the member types. */
export async function similarSuggestionsAction(title: string, details: string): Promise<SimilarSuggestion[]> {
  const user = await requireUser();
  const mod = await requireModule("suggestions");
  if (!mod.settings.showToMembers) return [];
  return findSimilarSuggestions(user.id, title.slice(0, 140), details.slice(0, 2000));
}

/**
 * Sends a suggestion. When a similar one already exists, the member's vote goes to it
 * instead (unless they say it's a different idea with `force`).
 */
export async function submitSuggestionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  await requireModule("suggestions");
  const t = await getTranslations("suggestions");
  const title = str(fd, "title").slice(0, 140);
  const details = optStr(fd, "details")?.slice(0, 2000) ?? null;
  if (title.length < 5) return { error: t("errors.title") };

  if (!bool(fd, "force")) {
    const [dup] = await findSimilarSuggestions(user.id, title, details ?? "", DUPLICATE_SCORE, 1);
    if (dup) {
      if (!dup.voted) await db.suggestionVote.create({ data: { suggestionId: dup.id, userId: user.id } });
      refresh();
      return {
        ok: true,
        message: dup.voted ? t("alreadyVoted", { title: dup.title }) : t("merged", { title: dup.title }),
        data: { mergedId: dup.id, addedVote: !dup.voted },
      };
    }
  } else {
    // "It's a different idea": take back the vote we just added to the look-alike.
    const undo = str(fd, "undoVote");
    if (undo) await db.suggestionVote.deleteMany({ where: { suggestionId: undo, userId: user.id } });
  }

  await db.suggestion.create({
    data: { title, details, authorId: user.id, votes: { create: { userId: user.id } } },
  });
  refresh();
  return { ok: true, message: t("sent"), data: { created: true } };
}

/** Adds or removes the member's vote. Returns the new state. */
export async function toggleSuggestionVoteAction(suggestionId: string) {
  const user = await requireUser();
  const mod = await requireModule("suggestions");
  if (!mod.settings.showToMembers) return null;
  const key = { suggestionId_userId: { suggestionId, userId: user.id } };
  const existing = await db.suggestionVote.findUnique({ where: key });
  if (existing) await db.suggestionVote.delete({ where: key });
  else if (await db.suggestion.findUnique({ where: { id: suggestionId }, select: { id: true } })) {
    await db.suggestionVote.create({ data: { suggestionId, userId: user.id } });
  }
  const votes = await db.suggestionVote.count({ where: { suggestionId } });
  refresh();
  return { voted: !existing, votes };
}

/** Members may withdraw their own suggestion while nobody else has voted for it. */
export async function deleteMySuggestionAction(suggestionId: string) {
  const user = await requireUser();
  const s = await db.suggestion.findUnique({ where: { id: suggestionId }, include: { _count: { select: { votes: true } } } });
  if (!s || s.authorId !== user.id || s._count.votes > 1) return;
  await db.suggestion.delete({ where: { id: suggestionId } });
  refresh();
}

// ───────────── Admin ─────────────

export async function updateSuggestionAction(suggestionId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("suggestions");
  const t = await getTranslations("admin.suggestions");
  const before = await db.suggestion.findUnique({ where: { id: suggestionId }, select: { status: true, adminNote: true } });
  const s = await db.suggestion.update({
    where: { id: suggestionId },
    data: {
      title: str(fd, "title").slice(0, 140) || undefined,
      status: oneOf(str(fd, "status"), SUGGESTION_STATUSES, "OPEN"),
      adminNote: optStr(fd, "adminNote")?.slice(0, 2000) ?? null,
    },
  });
  await audit(me.id, "admin.suggestion.update", s.title, { status: s.status });
  if (s.authorId && before && (before.status !== s.status || before.adminNote !== s.adminNote)) {
    void notify(s.authorId, "suggestionUpdate", { title: s.title }, `/suggestions?focus=${s.id}#s-${s.id}`);
  }
  refresh();
  return { ok: true, message: t("saved") };
}

/** Folds a duplicate the automatic check missed into another suggestion (votes move over). */
export async function mergeSuggestionAction(suggestionId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("suggestions");
  const t = await getTranslations("admin.suggestions");
  const targetId = str(fd, "targetId");
  const [source, target] = await Promise.all([
    db.suggestion.findUnique({ where: { id: suggestionId }, include: { votes: true } }),
    db.suggestion.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target || source.id === target.id) return { error: t("pickTarget") };
  const already = new Set((await db.suggestionVote.findMany({ where: { suggestionId: target.id }, select: { userId: true } })).map((v) => v.userId));
  const moving = source.votes.filter((v) => !already.has(v.userId));
  await db.$transaction([
    ...moving.map((v) => db.suggestionVote.create({ data: { suggestionId: target.id, userId: v.userId, createdAt: v.createdAt } })),
    db.suggestion.delete({ where: { id: source.id } }),
  ]);
  await audit(me.id, "admin.suggestion.merge", source.title, { into: target.title });
  refresh();
  return { ok: true, message: t("mergedInto", { title: target.title }) };
}

export async function deleteSuggestionAction(suggestionId: string) {
  const me = await requirePermission("suggestions");
  const s = await db.suggestion.delete({ where: { id: suggestionId } });
  await audit(me.id, "admin.suggestion.delete", s.title);
  refresh();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { fromLocalInput } from "@/lib/time";
import { audit } from "@/lib/audit";
import { optInt, optStr, str, type ActionState } from "@/lib/forms";
import { findOrCreateGame } from "@/modules/kallax/service";
import { getFriendIds } from "@/modules/friends/service";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("plays");
  if (!mod.enabled) throw new Error("Module disabled");
  return { user, mod };
}

const seatSchema = z.array(
  z.object({
    userId: z.string().optional(),
    guestName: z.string().max(60).optional(),
    score: z.number().int().nullable().optional(),
    isWinner: z.boolean().optional(),
  }),
);

export async function logPlayAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("plays.errors");
  const { timeZone } = await getSiteSettings();

  const gameName = str(fd, "game");
  if (!gameName) return { error: t("game") };
  const playedAt = fromLocalInput(`${str(fd, "playedAt")}T12:00`, timeZone);
  if (!playedAt) return { error: t("date") };

  let seats: z.infer<typeof seatSchema>;
  try {
    seats = seatSchema.parse(JSON.parse(str(fd, "participants") || "[]"));
  } catch {
    return { error: t("participants") };
  }

  // Only friends can be linked; their copy of the play waits for their OK.
  const friendIds = new Set(await getFriendIds(user.id));
  const self = seats.find((s) => s.userId === user.id) ?? { userId: user.id };
  const others = seats.filter((s) => s.userId !== user.id);
  if (others.some((s) => s.userId && !friendIds.has(s.userId))) return { error: t("notFriend") };
  if (!mod.settings.allowGuests && others.some((s) => !s.userId)) return { error: t("guestsDisabled") };
  const needsOk = Boolean(mod.settings.requireConfirmation);

  const game = await findOrCreateGame(gameName, user.id);
  const play = await db.play.create({
    data: {
      gameId: game.id,
      createdById: user.id,
      playedAt,
      durationMin: optInt(fd, "durationMin"),
      location: optStr(fd, "location"),
      notes: optStr(fd, "notes"),
      eventId: optStr(fd, "eventId"),
      participants: {
        create: [
          { userId: user.id, score: self.score ?? null, isWinner: Boolean(self.isWinner), status: "CONFIRMED" },
          ...others
            .filter((s) => s.userId || s.guestName?.trim())
            .map((s) => ({
              userId: s.userId ?? null,
              guestName: s.userId ? null : s.guestName!.trim(),
              score: s.score ?? null,
              isWinner: Boolean(s.isWinner),
              status: s.userId && needsOk ? "PENDING" : "CONFIRMED",
            })),
        ],
      },
    },
  });
  revalidatePath("/plays");
  redirect(`/plays?logged=${play.id}`);
}

/** A friend accepts (adds to their log) or declines a play someone logged with them. */
export async function respondPlayAction(participantId: string, accept: boolean) {
  const { user } = await guard();
  const p = await db.playParticipant.findUnique({ where: { id: participantId } });
  if (!p || p.userId !== user.id || p.status !== "PENDING") return;
  await db.playParticipant.update({ where: { id: participantId }, data: { status: accept ? "CONFIRMED" : "DECLINED" } });
  revalidatePath("/plays");
  revalidatePath("/home");
}

/**
 * Edit a logged play (its creator or an admin). Players already on the play keep their
 * confirmation; newly added friends are asked to confirm, like when logging.
 */
export async function updatePlayAction(playId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("plays.errors");
  const { timeZone } = await getSiteSettings();
  const play = await db.play.findUnique({ where: { id: playId }, include: { participants: true } });
  if (!play || (play.createdById !== user.id && !hasRole(user.role, "ADMIN"))) return { error: t("forbidden") };

  const gameName = str(fd, "game");
  if (!gameName) return { error: t("game") };
  const playedAt = fromLocalInput(`${str(fd, "playedAt")}T12:00`, timeZone);
  if (!playedAt) return { error: t("date") };

  let seats: z.infer<typeof seatSchema>;
  try {
    seats = seatSchema.parse(JSON.parse(str(fd, "participants") || "[]"));
  } catch {
    return { error: t("participants") };
  }
  const existing = new Map(play.participants.filter((p) => p.userId).map((p) => [p.userId!, p]));
  const friendIds = new Set(await getFriendIds(play.createdById));
  const linked = seats.filter((s) => s.userId);
  if (linked.some((s) => !existing.has(s.userId!) && !friendIds.has(s.userId!))) return { error: t("notFriend") };
  if (!mod.settings.allowGuests && seats.some((s) => !s.userId && s.guestName?.trim())) return { error: t("guestsDisabled") };
  const needsOk = Boolean(mod.settings.requireConfirmation);

  const game = await findOrCreateGame(gameName, user.id);
  await db.play.update({
    where: { id: playId },
    data: {
      gameId: game.id,
      playedAt,
      durationMin: optInt(fd, "durationMin"),
      location: optStr(fd, "location"),
      notes: optStr(fd, "notes"),
    },
  });

  // Members: update the ones who stay, remove the ones taken off, add the new ones.
  const keep = new Set(linked.map((s) => s.userId!));
  keep.add(play.createdById);
  await db.playParticipant.deleteMany({ where: { playId, userId: { notIn: [...keep] } } });
  for (const s of linked) {
    const before = existing.get(s.userId!);
    const data = { score: s.score ?? null, isWinner: Boolean(s.isWinner) };
    if (before) await db.playParticipant.update({ where: { id: before.id }, data });
    else
      await db.playParticipant.create({
        data: { playId, userId: s.userId!, ...data, status: s.userId === play.createdById || !needsOk ? "CONFIRMED" : "PENDING" },
      });
  }
  // Guests have no identity to keep: replace them.
  await db.playParticipant.deleteMany({ where: { playId, userId: null } });
  for (const s of seats.filter((x) => !x.userId && x.guestName?.trim())) {
    await db.playParticipant.create({
      data: { playId, guestName: s.guestName!.trim(), score: s.score ?? null, isWinner: Boolean(s.isWinner), status: "CONFIRMED" },
    });
  }
  if (play.createdById !== user.id) await audit(user.id, "play.update", playId);
  revalidatePath("/plays");
  redirect("/plays");
}

export async function deletePlayAction(playId: string) {
  const { user } = await guard();
  const play = await db.play.findUnique({ where: { id: playId } });
  if (!play) return;
  const isAdmin = hasRole(user.role, "ADMIN");
  if (play.createdById !== user.id && !isAdmin) return;
  await db.play.delete({ where: { id: playId } });
  if (play.createdById !== user.id) await audit(user.id, "play.delete", playId);
  revalidatePath("/plays");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { fromLocalInput } from "@/lib/time";
import { audit } from "@/lib/audit";
import { bool, oneOf, optFloat, optInt, optStr, str, type ActionState } from "@/lib/forms";
import { EVENT_KINDS, EVENT_VISIBILITIES, type AttendeeStatus } from "@/lib/constants";
import { findOrCreateGame } from "@/modules/kallax/service";
import { getEventForViewer, seatsTaken } from "./service";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("events");
  if (!mod.enabled) throw new Error("Module disabled");
  return { user, mod };
}

async function readEventForm(fd: FormData, mod: Awaited<ReturnType<typeof guard>>["mod"]) {
  const t = await getTranslations("events.errors");
  const { timeZone } = await getSiteSettings();
  const title = str(fd, "title");
  const startsAt = fromLocalInput(str(fd, "startsAt"), timeZone);
  const endsAt = str(fd, "endsAt") ? fromLocalInput(str(fd, "endsAt"), timeZone) : null;
  const kind = oneOf(str(fd, "kind"), EVENT_KINDS, "HOME_GAME");
  let visibility = oneOf(str(fd, "visibility"), EVENT_VISIBILITIES, "MEMBERS");

  if (!title || title.length > 120) return { error: t("title") };
  if (!startsAt) return { error: t("date") };
  if (endsAt && endsAt < startsAt) return { error: t("endBeforeStart") };
  if (kind === "HOME_GAME" && !mod.settings.allowHomeGames) return { error: t("homeGamesDisabled") };
  if (visibility === "PUBLIC" && !mod.settings.allowPublicEvents) visibility = "MEMBERS";

  const cap = Number(mod.settings.maxPlayersCap) || 100;
  const maxPlayers = optInt(fd, "maxPlayers");
  if (maxPlayers != null && (maxPlayers < 2 || maxPlayers > cap)) return { error: t("maxPlayers", { cap }) };

  return {
    data: {
      title,
      description: optStr(fd, "description"),
      kind,
      startsAt,
      endsAt,
      locationName: optStr(fd, "locationName"),
      address: optStr(fd, "address"),
      city: optStr(fd, "city"),
      latitude: optFloat(fd, "latitude"),
      longitude: optFloat(fd, "longitude"),
      visibility,
      maxPlayers,
      requiresApproval: bool(fd, "requiresApproval"),
    },
    games: str(fd, "games")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}

async function setEventGames(eventId: string, names: string[], userId: string) {
  await db.eventGame.deleteMany({ where: { eventId } });
  for (const name of names) {
    const game = await findOrCreateGame(name, userId);
    await db.eventGame.upsert({
      where: { eventId_gameId: { eventId, gameId: game.id } },
      create: { eventId, gameId: game.id },
      update: {},
    });
  }
}

export async function createEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const parsed = await readEventForm(fd, mod);
  if ("error" in parsed) return { error: parsed.error };
  const event = await db.event.create({ data: { ...parsed.data, hostId: user.id } });
  await setEventGames(event.id, parsed.games, user.id);
  revalidatePath("/events");
  redirect(`/events/${event.id}?created=1`);
}

async function canManage(eventId: string) {
  const user = await requireUser();
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  const isAdmin = hasRole(user.role, "ADMIN");
  if (event.hostId !== user.id && !isAdmin) return null;
  return { user, event, viaAdmin: event.hostId !== user.id };
}

export async function updateEventAction(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { mod } = await guard();
  const ctx = await canManage(eventId);
  if (!ctx) return { error: "Forbidden" };
  const parsed = await readEventForm(fd, mod);
  if ("error" in parsed) return { error: parsed.error };
  await db.event.update({ where: { id: eventId }, data: parsed.data });
  await setEventGames(eventId, parsed.games, ctx.user.id);
  if (ctx.viaAdmin) await audit(ctx.user.id, "event.update", eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/admin/events");
  // Admins editing from the console go back to the console.
  redirect(str(fd, "returnTo") === "admin" && hasRole(ctx.user.role, "ADMIN") ? "/admin/events" : `/events/${eventId}`);
}

export async function setEventStatusAction(eventId: string, status: "SCHEDULED" | "CANCELLED") {
  const ctx = await canManage(eventId);
  if (!ctx) return;
  await db.event.update({ where: { id: eventId }, data: { status } });
  if (ctx.viaAdmin) await audit(ctx.user.id, `event.${status.toLowerCase()}`, eventId);
  revalidatePath(`/events/${eventId}`);
}

export async function deleteEventAction(eventId: string) {
  const ctx = await canManage(eventId);
  if (!ctx) return;
  await db.event.delete({ where: { id: eventId } });
  if (ctx.viaAdmin) await audit(ctx.user.id, "event.delete", eventId, { title: ctx.event.title });
  revalidatePath("/events");
  redirect("/events");
}

/** Join / maybe / leave. Approval-only events create a request instead. */
export async function rsvpAction(eventId: string, wanted: "GOING" | "MAYBE" | "LEAVE") {
  const { user } = await guard();
  const event = await getEventForViewer(eventId, user.id);
  if (!event || event.status !== "SCHEDULED" || event.hostId === user.id) return;

  if (wanted === "LEAVE") {
    await db.eventAttendee.deleteMany({ where: { eventId, userId: user.id } });
  } else {
    let status: AttendeeStatus = wanted;
    const current = event.attendees.find((a) => a.userId === user.id);
    if (wanted === "GOING" && current?.status !== "GOING") {
      if (event.requiresApproval) status = "REQUESTED";
      else if (event.maxPlayers && seatsTaken(event) >= event.maxPlayers) return;
    }
    await db.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      create: { eventId, userId: user.id, status },
      update: { status },
    });
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/home");
}

/** Host accepts or declines a join request. */
export async function respondJoinRequestAction(attendeeId: string, accept: boolean) {
  const user = await requireUser();
  const a = await db.eventAttendee.findUnique({ where: { id: attendeeId }, include: { event: true } });
  if (!a || a.event.hostId !== user.id) return;
  await db.eventAttendee.update({ where: { id: attendeeId }, data: { status: accept ? "GOING" : "DECLINED" } });
  revalidatePath(`/events/${a.eventId}`);
  revalidatePath("/home");
}

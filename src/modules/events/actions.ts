"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { getModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { fromLocalInput } from "@/lib/time";
import { audit } from "@/lib/audit";
import { bool, oneOf, optFloat, optInt, optStr, str, type ActionState } from "@/lib/forms";
import { EVENT_KINDS, EVENT_VISIBILITIES, type AttendeeStatus } from "@/lib/constants";
import { getMyKallaxGames } from "@/modules/kallax/service";
import { getEventForViewer, seatsTaken } from "./service";
import { notify } from "@/modules/notifications/emails";

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
  const kind = oneOf(str(fd, "kind"), EVENT_KINDS, "GAME_NIGHT");
  let visibility = oneOf(str(fd, "visibility"), EVENT_VISIBILITIES, "MEMBERS");

  if (!title || title.length > 120) return { error: t("title") };
  if (!startsAt) return { error: t("date") };
  if (endsAt && endsAt < startsAt) return { error: t("endBeforeStart") };
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
    gameIds: fd.getAll("gameIds").map(String).filter(Boolean).slice(0, 12),
  };
}

/** Games on the menu: chosen from the host's Kallax (games already on the event stay allowed). */
async function setEventGames(eventId: string, gameIds: string[], hostId: string) {
  const current = (await db.eventGame.findMany({ where: { eventId }, select: { gameId: true } })).map((g) => g.gameId);
  const allowed = new Set([...current, ...(await getMyKallaxGames(hostId)).map((g) => g.gameId)]);
  await db.eventGame.deleteMany({ where: { eventId } });
  for (const gameId of new Set(gameIds.filter((id) => allowed.has(id)))) {
    await db.eventGame.create({ data: { eventId, gameId } });
  }
}

export async function createEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const parsed = await readEventForm(fd, mod);
  if ("error" in parsed) return { error: parsed.error };
  const event = await db.event.create({ data: { ...parsed.data, hostId: user.id } });
  await setEventGames(event.id, parsed.gameIds, user.id);
  revalidatePath("/events");
  redirect(`/events/${event.id}?created=1`);
}

async function canManage(eventId: string) {
  const user = await requireUser();
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  const isAdmin = can(user, "events");
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
  await setEventGames(eventId, parsed.gameIds, ctx.event.hostId);
  if (ctx.viaAdmin) await audit(ctx.user.id, "event.update", eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/admin/events");
  // Admins editing from the console go back to the console.
  redirect(str(fd, "returnTo") === "admin" && can(ctx.user, "events") ? "/admin/events" : `/events/${eventId}`);
}

export async function setEventStatusAction(eventId: string, status: "SCHEDULED" | "CANCELLED") {
  const ctx = await canManage(eventId);
  if (!ctx) return;
  await db.event.update({ where: { id: eventId }, data: { status } });
  if (ctx.viaAdmin) await audit(ctx.user.id, `event.${status.toLowerCase()}`, eventId);
  if (status === "CANCELLED" && ctx.event.status !== "CANCELLED") {
    const going = await db.eventAttendee.findMany({ where: { eventId, status: { in: ["GOING", "MAYBE"] } }, select: { userId: true } });
    for (const a of going) void notify(a.userId, "eventCancelled", { event: ctx.event.title }, `/events/${eventId}`);
  }
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
    if (status === "REQUESTED" && current?.status !== "REQUESTED") {
      void notify(event.hostId, "eventJoinRequest", { name: user.displayName, event: event.title }, `/events/${eventId}`);
    }
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
  if (accept) void notify(a.userId, "eventJoinAccepted", { event: a.event.title }, `/events/${a.eventId}`);
  revalidatePath(`/events/${a.eventId}`);
  revalidatePath("/home");
}

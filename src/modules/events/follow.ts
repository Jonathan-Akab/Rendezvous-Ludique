"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getEventForViewer } from "./service";
import { wantEmails } from "./followers";

// "Tell me when this host announces a game": a member who couldn't come follows the host,
// for all their games or only the similar ones (same kind, or one of the same games).

export async function followHostAction(eventId: string, similar: boolean) {
  const user = await requireUser();
  const event = await getEventForViewer(eventId, user.id);
  if (!event || event.hostId === user.id) return;
  const data = { similar, kind: event.kind, gameIds: JSON.stringify(event.games.map((g) => g.gameId)) };
  await db.hostFollow.upsert({ where: { userId_hostId: { userId: user.id, hostId: event.hostId } }, create: { userId: user.id, hostId: event.hostId, ...data }, update: data });
  await wantEmails(user.id, "hostNewEvent");
  revalidatePath(`/events/${eventId}`);
}

export async function unfollowHostAction(hostId: string) {
  const user = await requireUser();
  await db.hostFollow.deleteMany({ where: { userId: user.id, hostId } });
  revalidatePath("/settings");
  revalidatePath("/events", "layout");
}

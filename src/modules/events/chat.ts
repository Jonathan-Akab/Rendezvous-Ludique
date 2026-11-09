"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { notify } from "@/modules/notifications/emails";
import { wantEmails } from "./followers";
import { chatEvent, purgeClosedChat } from "./chatAccess";

export type ChatMessage = { id: string; body: string; at: string; mine: boolean; name: string; color: string };
export type ChatState = { open: boolean; closesAt: string; notify: boolean; messages: ChatMessage[] };

const MAX_LEN = 1000;

/** The conversation (reading it marks it read for this member). */
export async function loadChatAction(eventId: string): Promise<ChatState | null> {
  const user = await requireUser();
  const access = await chatEvent(eventId, user.id);
  if (!access) return null;
  if (!access.open) {
    await purgeClosedChat(eventId);
    return { open: false, closesAt: access.closesAt.toISOString(), notify: false, messages: [] };
  }
  const [rows, me] = await Promise.all([
    db.eventMessage.findMany({ where: { eventId }, orderBy: { createdAt: "asc" }, take: 300, include: { user: { select: { displayName: true, meepleColor: true } } } }),
    db.eventChatMember.upsert({ where: { eventId_userId: { eventId, userId: user.id } }, create: { eventId, userId: user.id, readAt: new Date() }, update: { readAt: new Date(), notified: false } }),
  ]);
  return {
    open: true,
    closesAt: access.closesAt.toISOString(),
    notify: me.notify,
    messages: rows.map((m) => ({ id: m.id, body: m.body, at: m.createdAt.toISOString(), mine: m.userId === user.id, name: m.user.displayName, color: m.user.meepleColor })),
  };
}

export async function postChatAction(eventId: string, body: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const text = String(body ?? "").trim().slice(0, MAX_LEN);
  if (!text) return { ok: false };
  const access = await chatEvent(eventId, user.id);
  if (!access?.open) return { ok: false };
  await db.eventMessage.create({ data: { eventId, userId: user.id, body: text } });

  // the others who asked for it hear about it — once, until they read the chat again
  const players = new Set([access.event.hostId, ...access.event.attendees.map((a) => a.userId)]);
  const waiting = await db.eventChatMember.findMany({ where: { eventId, notify: true, notified: false, userId: { not: user.id } } });
  for (const m of waiting) {
    if (!players.has(m.userId)) continue; // left the table since
    await db.eventChatMember.update({ where: { eventId_userId: { eventId, userId: m.userId } }, data: { notified: true } });
    void notify(m.userId, "eventChatMessage", { name: user.displayName, event: access.event.title }, `/events/${eventId}#chat`);
  }
  return { ok: true };
}

/** "M'avertir des nouveaux messages" for this table. */
export async function setChatNotifyAction(eventId: string, on: boolean) {
  const user = await requireUser();
  const access = await chatEvent(eventId, user.id);
  if (!access) return;
  await db.eventChatMember.upsert({ where: { eventId_userId: { eventId, userId: user.id } }, create: { eventId, userId: user.id, notify: on, readAt: new Date() }, update: { notify: on } });
  if (on) await wantEmails(user.id, "eventChatMessage");
}

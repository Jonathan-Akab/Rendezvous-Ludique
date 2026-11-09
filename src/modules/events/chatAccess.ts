import "server-only";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { fromLocalInput, toDateInput } from "@/lib/time";

// The table's private chat: only the host and the players going, open until the end of the
// day after the game (site's time zone). After that, its messages are deleted.

/** End of the day after the game: the chat closes then. */
export async function chatClosesAt(event: { startsAt: Date; endsAt: Date | null }) {
  const { timeZone } = await getSiteSettings();
  const day = toDateInput(event.endsAt ?? event.startsAt, timeZone);
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return fromLocalInput(`${next.toISOString().slice(0, 10)}T23:59`, timeZone) ?? new Date(event.startsAt.getTime() + 2 * 86_400_000);
}

/** The event, when this member may read its chat (host or player going); null otherwise. */
export async function chatEvent(eventId: string, userId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, hostId: true, startsAt: true, endsAt: true, status: true, chatEnabled: true, attendees: { where: { status: "GOING" }, select: { userId: true } } },
  });
  if (!event?.chatEnabled) return null;
  const member = event.hostId === userId || event.attendees.some((a) => a.userId === userId);
  if (!member) return null;
  const closesAt = await chatClosesAt(event);
  return { event, closesAt, open: Date.now() < closesAt.getTime() };
}

/** After closing time the conversation is gone for good. */
export async function purgeClosedChat(eventId: string) {
  await db.eventMessage.deleteMany({ where: { eventId } });
  await db.eventChatMember.deleteMany({ where: { eventId } });
}

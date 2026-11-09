import "server-only";
import { db } from "@/lib/db";
import { getFriendIds } from "@/modules/friends/service";
import { notify, parseNotifyPrefs, type NotifyType } from "@/modules/notifications/emails";

// Server-side only (never callable from the browser): emails preferences and the
// "a host you follow announced a game" notifications.

/** Following is asking for these emails: the member's email preference is turned on. */
export async function wantEmails(userId: string, type: NotifyType) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
  const prefs = parseNotifyPrefs(user?.notifyPrefs ?? null);
  if (prefs.has(type)) return;
  prefs.add(type);
  await db.user.update({ where: { id: userId }, data: { notifyPrefs: JSON.stringify([...prefs]) } });
}

/** A host just announced a game: tell the members who follow them (and may see it). */
export async function notifyHostFollowers(event: { id: string; title: string; hostId: string; kind: string; visibility: string }, gameIds: string[], hostName: string) {
  const follows = await db.hostFollow.findMany({ where: { hostId: event.hostId } });
  if (!follows.length) return;
  const friends = event.visibility === "FRIENDS" ? new Set(await getFriendIds(event.hostId)) : null;
  for (const f of follows) {
    if (friends && !friends.has(f.userId)) continue; // a friends-only game stays private
    if (f.similar) {
      let theirGames: string[] = [];
      try {
        theirGames = JSON.parse(f.gameIds ?? "[]");
      } catch {}
      const sameKind = f.kind === event.kind;
      const sameGame = gameIds.some((g) => theirGames.includes(g));
      if (!sameKind && !sameGame) continue;
    }
    await notify(f.userId, "hostNewEvent", { name: hostName, event: event.title }, `/events/${event.id}`);
  }
}

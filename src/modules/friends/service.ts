import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

export const PUBLIC_USER = { id: true, username: true, displayName: true, meepleColor: true, city: true } as const;

/** Ids of accepted friends. Cached per request. */
export const getFriendIds = cache(async (userId: string) => {
  const rows = await db.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
});

export async function getFriends(userId: string) {
  const ids = await getFriendIds(userId);
  return db.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: PUBLIC_USER, orderBy: { displayName: "asc" } });
}

export async function areFriends(a: string, b: string) {
  return (await getFriendIds(a)).includes(b);
}

/** Relationship between the viewer and another member, for buttons on profiles. */
export async function getRelation(viewerId: string, otherId: string) {
  const f = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: viewerId },
      ],
    },
  });
  if (!f) return { kind: "none" as const };
  if (f.status === "ACCEPTED") return { kind: "friends" as const, id: f.id };
  return f.requesterId === viewerId ? { kind: "sent" as const, id: f.id } : { kind: "received" as const, id: f.id };
}

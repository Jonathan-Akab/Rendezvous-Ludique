"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { notify } from "@/modules/notifications/emails";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("friends");
  if (!mod.enabled) throw new Error("Module disabled");
  return { user, mod };
}

export async function sendFriendRequest(otherId: string) {
  const { user, mod } = await guard();
  if (!mod.settings.allowRequests || otherId === user.id) return;
  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: otherId },
        { requesterId: otherId, addresseeId: user.id },
      ],
    },
  });
  if (existing) {
    // They already asked us: accept instead of creating a duplicate.
    if (existing.status === "PENDING" && existing.addresseeId === user.id) {
      await db.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    }
  } else {
    await db.friendship.create({ data: { requesterId: user.id, addresseeId: otherId } });
    void notify(otherId, "friendRequest", { name: user.displayName }, "/friends");
  }
  revalidatePath("/", "layout");
}

export async function respondFriendRequest(friendshipId: string, accept: boolean) {
  const { user } = await guard();
  const f = await db.friendship.findUnique({ where: { id: friendshipId } });
  if (!f || f.addresseeId !== user.id || f.status !== "PENDING") return;
  if (accept) {
    await db.friendship.update({ where: { id: f.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
  } else {
    await db.friendship.delete({ where: { id: f.id } });
  }
  revalidatePath("/", "layout");
}

/** Cancel a sent request or remove a friend. */
export async function removeFriendship(friendshipId: string) {
  const { user } = await guard();
  const f = await db.friendship.findUnique({ where: { id: friendshipId } });
  if (!f || (f.requesterId !== user.id && f.addresseeId !== user.id)) return;
  await db.friendship.delete({ where: { id: f.id } });
  revalidatePath("/", "layout");
}

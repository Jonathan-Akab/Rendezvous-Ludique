"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { str, type ActionState } from "@/lib/forms";

// The home page's board: everyone reads it, only staff with the "announcements" right write.

async function guard() {
  const user = await requireUser();
  if (!can(user, "announcements")) throw new Error("Forbidden");
  return user;
}

export async function postAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await guard();
  const t = await getTranslations("announcements");
  const body = str(fd, "body").trim();
  if (!body) return { error: t("errors.empty") };
  if (body.length > 2000) return { error: t("errors.tooLong") };
  const a = await db.announcement.create({ data: { body, pinned: fd.get("pinned") === "on", authorId: user.id } });
  await audit(user.id, "announcement.create", a.id);
  revalidatePath("/home");
  return { ok: true, message: t("posted") };
}

export async function updateAnnouncementAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await guard();
  const t = await getTranslations("announcements");
  const body = str(fd, "body").trim();
  if (!body) return { error: t("errors.empty") };
  if (body.length > 2000) return { error: t("errors.tooLong") };
  const done = await db.announcement.updateMany({ where: { id }, data: { body } });
  if (!done.count) return { error: t("errors.gone") };
  await audit(user.id, "announcement.update", id);
  revalidatePath("/home");
  return { ok: true, message: t("saved") };
}

export async function toggleAnnouncementPinAction(id: string) {
  const user = await guard();
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) return;
  await db.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  await audit(user.id, a.pinned ? "announcement.unpin" : "announcement.pin", id);
  revalidatePath("/home");
}

export async function deleteAnnouncementAction(id: string) {
  const user = await guard();
  await db.announcement.deleteMany({ where: { id } });
  await audit(user.id, "announcement.delete", id);
  revalidatePath("/home");
}

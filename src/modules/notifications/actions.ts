"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/forms";
import { NOTIFY_TYPES } from "./emails";

/** The email notifications the member wants (all off by default). */
export async function saveNotifyPrefsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const t = await getTranslations("settings.notifications");
  const chosen = fd.getAll("notify").map(String);
  const prefs = NOTIFY_TYPES.filter((n) => chosen.includes(n));
  await db.user.update({ where: { id: user.id }, data: { notifyPrefs: JSON.stringify(prefs) } });
  revalidatePath("/settings");
  return { ok: true, message: t("saved") };
}

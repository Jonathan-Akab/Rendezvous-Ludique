"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { bool, optStr, str, type ActionState } from "@/lib/forms";

// Facebook groups are curated by admins.

function readGroup(fd: FormData) {
  return {
    name: str(fd, "name").slice(0, 100),
    url: str(fd, "url").slice(0, 300),
    description: optStr(fd, "description")?.slice(0, 1000) ?? null,
    region: optStr(fd, "region")?.slice(0, 80) ?? null,
  };
}

const validUrl = (url: string) => /^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.com)\//i.test(url);

const refresh = () => {
  revalidatePath("/facebook");
  revalidatePath("/admin/facebook");
};

export async function saveFacebookGroupAction(groupId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("facebook");
  const t = await getTranslations("facebook.errors");
  const data = readGroup(fd);
  if (!data.name) return { error: t("name") };
  if (!validUrl(data.url)) return { error: t("url") };
  if (groupId) {
    await db.facebookGroup.update({ where: { id: groupId }, data: { ...data, active: bool(fd, "active") } });
  } else {
    const last = await db.facebookGroup.aggregate({ _max: { sortOrder: true } });
    await db.facebookGroup.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 10 } });
  }
  await audit(me.id, groupId ? "admin.facebook.update" : "admin.facebook.create", data.name);
  refresh();
  return { ok: true, message: t("saved") };
}

export async function moveFacebookGroupAction(groupId: string, direction: -1 | 1) {
  await requirePermission("facebook");
  const groups = await db.facebookGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const i = groups.findIndex((g) => g.id === groupId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= groups.length) return;
  [groups[i], groups[j]] = [groups[j], groups[i]];
  for (const [index, g] of groups.entries()) await db.facebookGroup.update({ where: { id: g.id }, data: { sortOrder: (index + 1) * 10 } });
  refresh();
}

export async function deleteFacebookGroupAction(groupId: string) {
  const me = await requirePermission("facebook");
  const g = await db.facebookGroup.delete({ where: { id: groupId } });
  await audit(me.id, "admin.facebook.delete", g.name);
  refresh();
}

/** The member's pinned tiles in "Groupes Facebook", in order ("featured" = the promoted page). */
export async function setFacebookPinsAction(keys: string[]) {
  const user = await requireUser();
  const pins = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string" && k.length <= 40))].slice(0, 50);
  await db.user.update({ where: { id: user.id }, data: { facebookPins: JSON.stringify(pins) } });
}

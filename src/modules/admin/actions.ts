"use server";

// Everything an admin can change. Every action re-checks the ADMIN role and is audited.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { getModule, moveModule, saveModule } from "@/lib/modules";
import { getSiteSettings, saveSiteSettings } from "@/lib/settings";
import { bool, HEX_COLOR, oneOf, optFloat, optInt, optStr, str, type ActionState } from "@/lib/forms";
import { LOCALES, ROLES, THEME_KEYS, USER_STATUSES, VISIBILITIES, type ThemeKey } from "@/lib/constants";
import { getManifest, type ModuleKey } from "@/modules/registry";
import { readGameFields, storeCoverFromForm } from "@/modules/games/mutations";
import { deleteStored, saveUpload, UploadError } from "@/lib/storage";

const admin = () => requireRole("ADMIN");
const refresh = () => revalidatePath("/", "layout");

// ───────────── Members ─────────────

export async function updateMemberAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const t = await getTranslations("admin.errors");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: t("notFound") };

  const role = oneOf(str(fd, "role"), ROLES, "MEMBER");
  const status = oneOf(str(fd, "status"), USER_STATUSES, "ACTIVE");
  if (userId === me.id && (role !== "ADMIN" || status !== "ACTIVE")) return { error: t("selfLockout") };

  const email = str(fd, "email").toLowerCase();
  const username = str(fd, "username").toLowerCase();
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) return { error: t("username") };
  const clash = await db.user.findFirst({ where: { id: { not: userId }, OR: [{ email }, { username }] } });
  if (clash) return { error: t("taken") };

  const meepleColor = str(fd, "meepleColor");
  const data = {
    displayName: str(fd, "displayName").slice(0, 60) || target.displayName,
    email,
    username,
    role,
    status,
    meepleColor: HEX_COLOR.test(meepleColor) ? meepleColor : target.meepleColor,
    bio: optStr(fd, "bio"),
    city: optStr(fd, "city"),
    region: optStr(fd, "region"),
    latitude: optFloat(fd, "latitude"),
    longitude: optFloat(fd, "longitude"),
    profileVisibility: oneOf(str(fd, "profileVisibility"), VISIBILITIES, "MEMBERS"),
    showLibrary: bool(fd, "showLibrary"),
    showPlays: bool(fd, "showPlays"),
    locale: oneOf(str(fd, "locale"), LOCALES, "fr"),
  };
  await db.user.update({ where: { id: userId }, data });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
  await audit(me.id, "admin.member.update", target.username, {
    role: target.role !== role ? `${target.role}→${role}` : undefined,
    status: target.status !== status ? `${target.status}→${status}` : undefined,
  });
  revalidatePath("/admin/members");
  return { ok: true, message: t("saved") };
}

export async function quickSetRoleAction(userId: string, fd: FormData) {
  const me = await admin();
  const role = oneOf(str(fd, "role"), ROLES, "MEMBER");
  if (userId === me.id) return;
  const u = await db.user.update({ where: { id: userId }, data: { role } });
  await audit(me.id, "admin.member.role", u.username, { role });
  revalidatePath("/admin/members");
}

export async function setMemberStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  const me = await admin();
  if (userId === me.id) return;
  const u = await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
  await audit(me.id, `admin.member.${status.toLowerCase()}`, u.username);
  revalidatePath("/admin/members");
}

export async function resetPasswordAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const t = await getTranslations("admin.errors");
  const password = str(fd, "password");
  if (password.length < 8) return { error: t("passwordLength") };
  const u = await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId } });
  await audit(me.id, "admin.member.resetPassword", u.username);
  return { ok: true, message: t("passwordReset") };
}

export async function revokeSessionsAction(userId: string) {
  const me = await admin();
  await db.session.deleteMany({ where: { userId } });
  await audit(me.id, "admin.member.revokeSessions", userId);
  revalidatePath(`/admin/members/${userId}`);
}

export async function deleteMemberAction(userId: string) {
  const me = await admin();
  if (userId === me.id) return;
  const u = await db.user.delete({ where: { id: userId } });
  // clean up libraries left without members
  await db.library.deleteMany({ where: { members: { none: {} } } });
  await audit(me.id, "admin.member.delete", u.username, { email: u.email });
  revalidatePath("/admin/members");
  redirect("/admin/members");
}

// ───────────── Modules ─────────────

export async function saveModuleAction(key: ModuleKey, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const manifest = getManifest(key);
  const settings: Record<string, string | number | boolean> = {};
  for (const field of manifest.settings) {
    if (field.type === "boolean") settings[field.key] = bool(fd, field.key);
    else if (field.type === "number") {
      const n = (field.decimal ? optFloat(fd, field.key) : optInt(fd, field.key)) ?? field.default;
      settings[field.key] = Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, n));
    } else if (field.type === "select") {
      const v = str(fd, field.key);
      settings[field.key] = field.options.includes(v) ? v : field.default;
    } else if (field.type === "url") {
      const v = str(fd, field.key);
      settings[field.key] = /^https?:\/\//i.test(v) ? v : "";
    } else settings[field.key] = str(fd, field.key);
  }
  const enabled = bool(fd, "enabled");
  await saveModule(key, enabled, settings);
  await audit(me.id, "admin.module.save", key, { enabled, settings });
  refresh();
  return { ok: true, message: (await getTranslations("admin.errors"))("saved") };
}

// ───────────── Site & appearance ─────────────

export async function saveSiteSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const t = await getTranslations("admin.errors");
  const timeZone = str(fd, "timeZone");
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    return { error: t("timeZone") };
  }
  const patch = {
    siteName: str(fd, "siteName").slice(0, 60) || "Rendezvous Ludique",
    registrationOpen: bool(fd, "registrationOpen"),
    announcement: str(fd, "announcement").slice(0, 300),
    defaultLocale: oneOf(str(fd, "defaultLocale"), LOCALES, "fr"),
    timeZone,
  };
  await saveSiteSettings(patch);
  await audit(me.id, "admin.site.save", undefined, patch);
  refresh();
  return { ok: true, message: t("saved") };
}

export async function saveAppearanceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const t = await getTranslations("admin.errors");
  const enabledThemes = fd.getAll("enabledThemes").filter((v): v is ThemeKey => THEME_KEYS.includes(v as ThemeKey));
  const defaultTheme = oneOf(str(fd, "defaultTheme"), THEME_KEYS, "system");
  if (!["system", "light", "dark"].includes(defaultTheme) && !enabledThemes.includes(defaultTheme)) enabledThemes.push(defaultTheme);
  await saveSiteSettings({ enabledThemes, defaultTheme });
  await audit(me.id, "admin.appearance.save", undefined, { enabledThemes, defaultTheme });
  refresh();
  return { ok: true, message: t("saved") };
}

// ───────────── Content ─────────────

export async function saveGameAction(gameId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const t = await getTranslations("admin.errors");
  const data = readGameFields(fd);
  if (!data.name) return { error: t("gameName") };
  let coverFileId: string | null | undefined;
  try {
    coverFileId = await storeCoverFromForm(fd, me.id);
  } catch (e) {
    if (e instanceof UploadError) return { error: (await getTranslations("games.errors"))(`upload.${e.code}`) };
    throw e;
  }
  if (gameId) {
    const old = await db.game.findUnique({ where: { id: gameId } });
    if (coverFileId && old?.coverFileId) await deleteStored(old.coverFileId);
    await db.game.update({ where: { id: gameId }, data: { ...data, ...(coverFileId ? { coverFileId } : {}) } });
  } else {
    await db.game.create({ data: { ...data, coverFileId, createdById: me.id } });
  }
  await audit(me.id, gameId ? "admin.game.update" : "admin.game.create", data.name);
  revalidatePath("/admin/games");
  return { ok: true, message: t("saved") };
}
/** Merge a duplicate game into another: moves library copies, plays and event links. */
export async function mergeGameAction(fromId: string, fd: FormData) {
  const me = await admin();
  const intoId = str(fd, "intoId");
  if (!intoId || intoId === fromId) return;
  const [from, into] = await Promise.all([db.game.findUnique({ where: { id: fromId } }), db.game.findUnique({ where: { id: intoId } })]);
  if (!from || !into) return;
  const copies = await db.libraryGame.findMany({ where: { gameId: fromId } });
  for (const c of copies) {
    const dup = await db.libraryGame.findUnique({ where: { libraryId_gameId: { libraryId: c.libraryId, gameId: intoId } } });
    if (dup) await db.libraryGame.delete({ where: { id: c.id } });
    else await db.libraryGame.update({ where: { id: c.id }, data: { gameId: intoId } });
  }
  await db.play.updateMany({ where: { gameId: fromId }, data: { gameId: intoId } });
  const links = await db.eventGame.findMany({ where: { gameId: fromId } });
  for (const l of links) {
    await db.eventGame.delete({ where: { eventId_gameId: { eventId: l.eventId, gameId: fromId } } });
    await db.eventGame.upsert({
      where: { eventId_gameId: { eventId: l.eventId, gameId: intoId } },
      create: { eventId: l.eventId, gameId: intoId },
      update: {},
    });
  }
  await db.game.delete({ where: { id: fromId } });
  await audit(me.id, "admin.game.merge", `${from.name} → ${into.name}`);
  revalidatePath("/admin/games");
}

export async function deleteGameAction(gameId: string) {
  const me = await admin();
  const g = await db.game.delete({ where: { id: gameId } });
  await audit(me.id, "admin.game.delete", g.name);
  revalidatePath("/admin/games");
}

export async function adminEventStatusAction(eventId: string, status: "SCHEDULED" | "CANCELLED") {
  const me = await admin();
  const e = await db.event.update({ where: { id: eventId }, data: { status } });
  await audit(me.id, `admin.event.${status.toLowerCase()}`, e.title);
  revalidatePath("/admin/events");
}

export async function adminDeleteEventAction(eventId: string) {
  const me = await admin();
  const e = await db.event.delete({ where: { id: eventId } });
  await audit(me.id, "admin.event.delete", e.title);
  revalidatePath("/admin/events");
}

export async function adminDeleteLibraryAction(libraryId: string) {
  const me = await admin();
  const l = await db.library.delete({ where: { id: libraryId } });
  await audit(me.id, "admin.library.delete", l.name);
  revalidatePath("/admin/libraries");
}

export async function adminDeletePlayAction(playId: string) {
  const me = await admin();
  await db.play.delete({ where: { id: playId } });
  await audit(me.id, "admin.play.delete", playId);
  revalidatePath("/admin/plays");
}

// ───────────── AI usage controls ─────────────

/** Quick AI controls (global switches and budgets) without touching the other settings. */
export async function saveAiLimitsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const current = await getModule("ai");
  const settings = {
    ...current.settings,
    claudeEnabled: bool(fd, "claudeEnabled"),
    freeEnabled: bool(fd, "freeEnabled"),
    autoFallbackToFree: bool(fd, "autoFallbackToFree"),
    monthlyBudgetUsd: Math.max(0, optFloat(fd, "monthlyBudgetUsd") ?? Number(current.settings.monthlyBudgetUsd)),
    memberMonthlyBudgetUsd: Math.max(0, optFloat(fd, "memberMonthlyBudgetUsd") ?? Number(current.settings.memberMonthlyBudgetUsd)),
    dailyQuestionLimit: Math.max(1, optInt(fd, "dailyQuestionLimit") ?? Number(current.settings.dailyQuestionLimit)),
  };
  await saveModule("ai", current.enabled, settings);
  await audit(me.id, "admin.ai.limits", undefined, settings);
  revalidatePath("/admin/ai");
  revalidatePath("/ai");
  return { ok: true, message: (await getTranslations("admin.errors"))("saved") };
}

/** Per-member AI access and limits. Empty budget/limit fields mean "use the default". */
export async function setMemberAiAction(userId: string, fd: FormData) {
  const me = await admin();
  const access = oneOf(str(fd, "access"), ["DEFAULT", "FREE_ONLY", "NONE"] as const, "DEFAULT");
  const monthlyBudgetUsd = optFloat(fd, "monthlyBudgetUsd");
  const dailyLimit = optInt(fd, "dailyLimit");
  const data = {
    access,
    monthlyBudgetUsd: monthlyBudgetUsd == null ? null : Math.max(0, monthlyBudgetUsd),
    dailyLimit: dailyLimit == null ? null : Math.max(0, dailyLimit),
  };
  await db.aiMemberSetting.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await audit(me.id, "admin.ai.member", userId, data);
  revalidatePath("/admin/ai");
}
/** Default menu order for everyone (members can still set their own). */
export async function moveModuleAction(key: ModuleKey, direction: -1 | 1) {
  const me = await admin();
  await moveModule(key, direction);
  await audit(me.id, "admin.module.move", key, { direction });
  refresh();
}
// ───────────── Theme & login pictures ─────────────

const PICTURE_KEYS = [...THEME_KEYS, "login"] as string[];

export async function saveThemeImageAction(key: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await admin();
  const t = await getTranslations("admin.errors");
  if (!PICTURE_KEYS.includes(key)) return { error: t("notFound") };
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: (await getTranslations("games.errors"))("upload.empty") };
  try {
    const stored = await saveUpload(file, "IMAGE", me.id);
    const { themeImages } = await getSiteSettings();
    if (themeImages[key]) await deleteStored(themeImages[key]);
    await saveSiteSettings({ themeImages: { ...themeImages, [key]: stored.id } });
  } catch (e) {
    if (e instanceof UploadError) return { error: (await getTranslations("games.errors"))(`upload.${e.code}`) };
    throw e;
  }
  await audit(me.id, "admin.appearance.picture", key);
  refresh();
  return { ok: true, message: t("saved") };
}

export async function removeThemeImageAction(key: string) {
  const me = await admin();
  const { themeImages } = await getSiteSettings();
  if (!themeImages[key]) return;
  await deleteStored(themeImages[key]);
  const next = { ...themeImages };
  delete next[key];
  await saveSiteSettings({ themeImages: next });
  await audit(me.id, "admin.appearance.picture.remove", key);
  refresh();
}
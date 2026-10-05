"use server";

// Everything an admin can change. Every action re-checks the ADMIN role and is audited.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireFullAdmin, requirePermission } from "@/lib/auth/guards";
import { isFullAdmin, serializePermissions } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { getModule, moveModule, saveModule, setModuleOrder } from "@/lib/modules";
import { getSiteSettings, saveSiteSettings } from "@/lib/settings";
import { appUrl, emailLayout, mailConfigured, sendMail } from "@/lib/mail";
import { bool, HEX_COLOR, oneOf, optFloat, optInt, optStr, str, type ActionState } from "@/lib/forms";
import { LOCALES, ROLES, THEME_KEYS, USER_STATUSES, VISIBILITIES, type ThemeKey } from "@/lib/constants";
import { getManifest, MODULES, type ModuleKey } from "@/modules/registry";
import { readGameFields, storeCoverFromForm } from "@/modules/games/mutations";
import { normalizeName } from "@/modules/games/service";
import { deleteStored, saveUpload, UploadError } from "@/lib/storage";

const refresh = () => revalidatePath("/", "layout");

// ───────────── Members ─────────────
// With the "members" right you manage member accounts; staff accounts (moderators,
// admins), roles and rights are for full admins only.

async function manageableUser(me: { id: string; role: string; permissions: string | null }, userId: string) {
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return null;
  if (!isFullAdmin(me) && target.role !== "MEMBER") return null;
  return target;
}

export async function updateMemberAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("members");
  const t = await getTranslations("admin.errors");
  const target = await manageableUser(me, userId);
  if (!target) return { error: t("notAllowed") };

  const full = isFullAdmin(me);
  const role = full ? oneOf(str(fd, "role"), ROLES, "MEMBER") : target.role;
  const status = oneOf(str(fd, "status"), USER_STATUSES, "ACTIVE");
  // Rights per console section (full admins only). "fullAdmin" keeps an admin unrestricted.
  const permissions = full
    ? serializePermissions(role, bool(fd, "fullAdmin"), fd.getAll("permissions").map(String))
    : target.permissions;
  if (userId === me.id && full && permissions !== null) return { error: t("selfLockout") };
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
    permissions,
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
    permissions: target.permissions !== permissions ? permissions ?? "full" : undefined,
  });
  revalidatePath("/admin/members");
  return { ok: true, message: t("saved") };
}

export async function quickSetRoleAction(userId: string, fd: FormData) {
  const me = await requireFullAdmin();
  const role = oneOf(str(fd, "role"), ROLES, "MEMBER");
  if (userId === me.id) return;
  const u = await db.user.update({ where: { id: userId }, data: { role } });
  await audit(me.id, "admin.member.role", u.username, { role });
  revalidatePath("/admin/members");
}

export async function setMemberStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  const me = await requirePermission("members");
  if (!(await manageableUser(me, userId))) return;
  if (userId === me.id) return;
  const u = await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
  await audit(me.id, `admin.member.${status.toLowerCase()}`, u.username);
  revalidatePath("/admin/members");
}

export async function resetPasswordAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("members");
  if (!(await manageableUser(me, userId))) return { error: (await getTranslations("admin.errors"))("notAllowed") };
  const t = await getTranslations("admin.errors");
  const password = str(fd, "password");
  if (password.length < 8) return { error: t("passwordLength") };
  const u = await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId } });
  await audit(me.id, "admin.member.resetPassword", u.username);
  return { ok: true, message: t("passwordReset") };
}

export async function revokeSessionsAction(userId: string) {
  const me = await requirePermission("members");
  if (!(await manageableUser(me, userId))) return;
  await db.session.deleteMany({ where: { userId } });
  await audit(me.id, "admin.member.revokeSessions", userId);
  revalidatePath(`/admin/members/${userId}`);
}

export async function deleteMemberAction(userId: string) {
  const me = await requirePermission("members");
  if (!(await manageableUser(me, userId))) return;
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
  const me = await requirePermission("modules");
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
  const me = await requirePermission("settings");
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
    registrationApproval: bool(fd, "registrationApproval"),
    requireEmailConfirmation: bool(fd, "requireEmailConfirmation"),
    // never below the age of majority in Québec
    minimumAge: Math.min(99, Math.max(18, optInt(fd, "minimumAge") ?? 18)),
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
  const me = await requirePermission("appearance");
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

/** Admins can correct a Ludothèque entry (it is never edited by members). */
export async function saveGameAction(gameId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("games");
  const t = await getTranslations("admin.errors");
  const data = readGameFields(fd);
  if (!data.name) return { error: t("gameName") };
  const normalizedName = normalizeName(data.name);
  const clash = await db.game.findFirst({ where: { normalizedName, id: { not: gameId } } });
  if (clash) return { error: t("gameExists", { name: clash.name }) };
  let coverFileId: string | null | undefined;
  try {
    coverFileId = await storeCoverFromForm(fd, me.id);
  } catch (e) {
    if (e instanceof UploadError) return { error: (await getTranslations("games.errors"))(`upload.${e.code}`) };
    throw e;
  }
  const old = await db.game.findUnique({ where: { id: gameId } });
  if (!old) return { error: t("notFound") };
  if (coverFileId && old.coverFileId) await deleteStored(old.coverFileId);
  // Ludothèque-only details, and "expansion of" (never itself, never an expansion's expansion).
  const baseGameId = str(fd, "baseGameId") || null;
  const base = baseGameId && baseGameId !== gameId ? await db.game.findUnique({ where: { id: baseGameId }, select: { id: true, baseGameId: true } }) : null;
  const weight = optFloat(fd, "weight");
  await db.game.update({
    where: { id: gameId },
    data: {
      ...data,
      normalizedName,
      weight: weight != null && weight >= 1 && weight <= 5 ? weight : null,
      categories: optStr(fd, "categories")?.slice(0, 300) ?? null,
      description: optStr(fd, "description")?.slice(0, 4000) ?? null,
      baseGameId: base ? (base.baseGameId ?? base.id) : null,
      ...(coverFileId ? { coverFileId } : {}),
    },
  });
  await audit(me.id, "admin.game.update", data.name);
  revalidatePath("/admin/games");
  return { ok: true, message: t("saved") };
}

/** Merge a duplicate Ludothèque entry into another: moves Kallax copies, ratings, rulebooks, plays, events, chats and listings. */
export async function mergeGameAction(fromId: string, fd: FormData) {
  const me = await requirePermission("games");
  const intoId = str(fd, "intoId");
  if (!intoId || intoId === fromId) return;
  const [from, into] = await Promise.all([db.game.findUnique({ where: { id: fromId } }), db.game.findUnique({ where: { id: intoId } })]);
  if (!from || !into) return;
  for (const c of await db.kallaxGame.findMany({ where: { gameId: fromId } })) {
    const dup = await db.kallaxGame.findUnique({ where: { libraryId_gameId: { libraryId: c.libraryId, gameId: intoId } } });
    if (dup) await db.kallaxGame.delete({ where: { id: c.id } });
    else await db.kallaxGame.update({ where: { id: c.id }, data: { gameId: intoId } });
  }
  for (const r of await db.gameRating.findMany({ where: { gameId: fromId } })) {
    const dup = await db.gameRating.findUnique({ where: { gameId_userId: { gameId: intoId, userId: r.userId } } });
    if (dup) await db.gameRating.delete({ where: { id: r.id } });
    else await db.gameRating.update({ where: { id: r.id }, data: { gameId: intoId } });
  }
  await db.rulebook.updateMany({ where: { gameId: fromId }, data: { gameId: intoId } });
  await db.play.updateMany({ where: { gameId: fromId }, data: { gameId: intoId } });
  await db.aiChat.updateMany({ where: { gameId: fromId }, data: { gameId: intoId } });
  await db.bazaarListing.updateMany({ where: { gameId: fromId }, data: { gameId: intoId } });
  for (const l of await db.eventGame.findMany({ where: { gameId: fromId } })) {
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
  const me = await requirePermission("games");
  const g = await db.game.delete({ where: { id: gameId } });
  await audit(me.id, "admin.game.delete", g.name);
  revalidatePath("/admin/games");
}

export async function adminEventStatusAction(eventId: string, status: "SCHEDULED" | "CANCELLED") {
  const me = await requirePermission("events");
  const e = await db.event.update({ where: { id: eventId }, data: { status } });
  await audit(me.id, `admin.event.${status.toLowerCase()}`, e.title);
  revalidatePath("/admin/events");
}

export async function adminDeleteEventAction(eventId: string) {
  const me = await requirePermission("events");
  const e = await db.event.delete({ where: { id: eventId } });
  await audit(me.id, "admin.event.delete", e.title);
  revalidatePath("/admin/events");
}

export async function adminDeleteLibraryAction(libraryId: string) {
  const me = await requirePermission("libraries");
  const l = await db.library.delete({ where: { id: libraryId } });
  await audit(me.id, "admin.library.delete", l.name);
  revalidatePath("/admin/libraries");
}

export async function adminDeletePlayAction(playId: string) {
  const me = await requirePermission("plays");
  await db.play.delete({ where: { id: playId } });
  await audit(me.id, "admin.play.delete", playId);
  revalidatePath("/admin/plays");
}

// ───────────── AI usage controls ─────────────

/** Quick AI controls (global switches and budgets) without touching the other settings. */
export async function saveAiLimitsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("ai");
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
  const me = await requirePermission("ai");
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
  const me = await requirePermission("modules");
  await moveModule(key, direction);
  await audit(me.id, "admin.module.move", key, { direction });
  refresh();
}
// ───────────── Theme & login pictures ─────────────

const PICTURE_KEYS = [...THEME_KEYS, "login"] as string[];

export async function saveThemeImageAction(key: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("appearance");
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
  const me = await requirePermission("appearance");
  const { themeImages } = await getSiteSettings();
  if (!themeImages[key]) return;
  await deleteStored(themeImages[key]);
  const next = { ...themeImages };
  delete next[key];
  await saveSiteSettings({ themeImages: next });
  await audit(me.id, "admin.appearance.picture.remove", key);
  refresh();
}
/** Makes the admin's own sidebar order the default order for every member. */
export async function applyMyMenuOrderAsDefaultAction() {
  const me = await requirePermission("modules");
  const user = await db.user.findUnique({ where: { id: me.id }, select: { navOrder: true } });
  let hrefs: string[] = [];
  try {
    hrefs = user?.navOrder ? JSON.parse(user.navOrder) : [];
  } catch {
    hrefs = [];
  }
  const keys = hrefs.map((h) => MODULES.find((m) => m.href === h)?.key).filter((k): k is ModuleKey => Boolean(k));
  if (!keys.length) return;
  await setModuleOrder(keys);
  await audit(me.id, "admin.module.order", undefined, { keys });
  refresh();
}

// ───────────── Sign-ups ─────────────

/** Approves a pending sign-up: the account becomes active. */
export async function approveSignupAction(userId: string) {
  const me = await requirePermission("registrations");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.status !== "PENDING") return;
  await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  await audit(me.id, "admin.signup.approve", u.username);
  revalidatePath("/admin", "layout");
}

/** Refuses a pending sign-up: the account is removed. */
export async function rejectSignupAction(userId: string) {
  const me = await requirePermission("registrations");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.status !== "PENDING") return;
  await db.user.delete({ where: { id: userId } });
  await db.library.deleteMany({ where: { members: { none: {} } } });
  await audit(me.id, "admin.signup.reject", u.username, { email: u.email });
  revalidatePath("/admin", "layout");
}

// ───────────── Email ─────────────

/** Sends a test email to the admin's own address (checks the SMTP settings). */
export async function sendTestEmailAction(_prev: ActionState): Promise<ActionState> {
  const me = await requirePermission("settings");
  const t = await getTranslations("admin.site");
  if (!mailConfigured()) return { error: t("mailOff") };
  const { siteName } = await getSiteSettings();
  const { html, text } = emailLayout({
    siteName,
    title: t("testMailTitle"),
    paragraphs: [t("testMailBody")],
    button: { label: siteName, url: appUrl() },
    footer: appUrl(),
  });
  try {
    await sendMail({ to: me.email, subject: t("testMailTitle"), html, text });
  } catch (e) {
    return { error: t("testMailFailed", { reason: (e as Error).message.slice(0, 200) }) };
  }
  return { ok: true, message: t("testMailSent", { email: me.email }) };
}

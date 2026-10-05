"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSiteSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { HEX_COLOR, str, type ActionState } from "@/lib/forms";
import { LOCALE_COOKIE, LOCALES, THEME_COOKIE, type Locale } from "@/lib/constants";
import { createPersonalLibrary } from "@/modules/kallax/service";
import { mailConfigured } from "@/lib/mail";
import { consumeEmailToken } from "@/lib/auth/emailTokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/modules/notifications/emails";

/** Email confirmation applies when admins want it and email is set up. */
async function confirmationRequired() {
  return mailConfigured() && (await getSiteSettings()).requireEmailConfirmation;
}

/** Full years between a birth date and today. */
function ageOn(birth: Date, today = new Date()) {
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const YEAR = 60 * 60 * 24 * 365;

async function rememberPreferences(locale: string, theme: string) {
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations("auth.errors");
  const identifier = str(fd, "identifier").toLowerCase();
  const password = str(fd, "password");
  if (!identifier || !password) return { error: t("missing") };

  const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: t("invalid") };
  if (user.status === "PENDING") return { error: t("pending") };
  if (user.status !== "ACTIVE") return { error: t("suspended") };
  if (!user.emailVerifiedAt && (await confirmationRequired())) return { error: t("unverified"), data: { resend: identifier } };

  if (user.guideShowNext) await db.user.update({ where: { id: user.id }, data: { guidePending: true } });
  await createSession(user.id);
  await rememberPreferences(user.locale, user.theme);
  redirect(safeNext(str(fd, "next")));
}

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_-]+$/),
  displayName: z.string().min(1).max(60),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  meepleColor: z.string().regex(HEX_COLOR),
  locale: z.enum(LOCALES),
});

// Against fake accounts, without any outside service: a hidden field real people leave
// empty, a minimum time to fill the form, a limit per address, and (by default) a team
// member approves each new account.
const SIGNUPS_PER_HOUR = 5;
const recentSignups = new Map<string, number[]>();

async function clientAddress() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations("auth.errors");
  const settings = await getSiteSettings();
  if (!settings.registrationOpen) return { error: t("registrationClosed") };

  // Bots fill every field and submit instantly.
  const startedAt = Number(str(fd, "startedAt"));
  if (str(fd, "website") || !startedAt || Date.now() - startedAt < 4000) return { error: t("bot") };
  const ip = await clientAddress();
  const hour = Date.now() - 3_600_000;
  const recent = (recentSignups.get(ip) ?? []).filter((ts) => ts > hour);
  if (recent.length >= SIGNUPS_PER_HOUR) return { error: t("tooMany") };

  const parsed = registerSchema.safeParse({
    username: str(fd, "username").toLowerCase(),
    displayName: str(fd, "displayName"),
    email: str(fd, "email").toLowerCase(),
    password: str(fd, "password"),
    meepleColor: str(fd, "meepleColor"),
    locale: str(fd, "locale") || settings.defaultLocale,
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "form");
    return { error: t(`field.${field}` as "field.username") };
  }
  const data = parsed.data;
  if (str(fd, "password") !== str(fd, "confirm")) return { error: t("passwordMismatch") };
  // Minimum age (Québec: age of majority). The birth date is only checked, never stored.
  const birth = new Date(`${str(fd, "birthDate")}T12:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > new Date() || birth.getFullYear() < 1900) return { error: t("field.birthDate") };
  if (ageOn(birth) < settings.minimumAge) return { error: t("tooYoung", { age: settings.minimumAge }) };
  const signupNote = str(fd, "signupNote").slice(0, 500);
  if (settings.registrationApproval && signupNote.length < 10) return { error: t("field.signupNote") };

  const taken = await db.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
    select: { email: true },
  });
  if (taken) return { error: taken.email === data.email ? t("emailTaken") : t("usernameTaken") };

  // Bootstrap: the very first account on a fresh install becomes admin (and is active).
  const isFirst = (await db.user.count()) === 0;
  const pending = settings.registrationApproval && !isFirst;
  const mustConfirm = !isFirst && (await confirmationRequired());
  const user = await db.user.create({
    data: {
      username: data.username,
      displayName: data.displayName,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      meepleColor: data.meepleColor,
      locale: data.locale as Locale,
      theme: settings.defaultTheme,
      role: isFirst ? "ADMIN" : "MEMBER",
      status: pending ? "PENDING" : "ACTIVE",
      signupNote: signupNote || null,
      emailVerifiedAt: mustConfirm ? null : new Date(),
    },
  });
  recentSignups.set(ip, [...recent, Date.now()]);
  await createPersonalLibrary(user.id, user.displayName);
  await audit(user.id, "user.register", user.username, isFirst ? { bootstrapAdmin: true } : pending ? { pending: true } : undefined);
  // Confirm the email address first: the link signs them in.
  if (mustConfirm) {
    await sendVerificationEmail(user).catch((e) => console.error("[signup] confirmation email failed:", e));
    redirect(pending ? "/?pending=1&verify=1" : "/?verify=1");
  }
  // Waiting for approval: no session yet.
  if (pending) redirect("/?pending=1");

  await createSession(user.id);
  await rememberPreferences(user.locale, user.theme);
  redirect("/home?welcome=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

// ───────────── Email: confirmation and forgotten password ─────────────

const recentResets = new Map<string, number>();

/** Sends the confirmation link again (same answer whether the account exists or not). */
export async function resendVerificationAction(identifier: string): Promise<ActionState> {
  const t = await getTranslations("auth");
  const key = identifier.trim().toLowerCase();
  const user = key ? await db.user.findFirst({ where: { OR: [{ email: key }, { username: key }] } }) : null;
  const last = recentResets.get(`v:${key}`) ?? 0;
  if (user && !user.emailVerifiedAt && Date.now() - last > 60_000 && mailConfigured()) {
    recentResets.set(`v:${key}`, Date.now());
    await sendVerificationEmail(user).catch((e) => console.error("[verify] resend failed:", e));
  }
  return { ok: true, message: t("verifySent") };
}

/** "Forgot my password": emails a reset link. Always the same answer (no account probing). */
export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations("auth");
  if (!mailConfigured()) return { error: t("errors.mailOff") };
  const key = str(fd, "identifier").toLowerCase();
  if (!key) return { error: t("errors.missing") };
  const user = await db.user.findFirst({ where: { OR: [{ email: key }, { username: key }] } });
  const last = recentResets.get(`r:${key}`) ?? 0;
  if (user && user.status === "ACTIVE" && Date.now() - last > 60_000) {
    recentResets.set(`r:${key}`, Date.now());
    await sendPasswordResetEmail(user).catch((e) => console.error("[reset] email failed:", e));
  }
  return { ok: true, message: t("resetSent") };
}

/** Sets a new password from the emailed link, then signs the person in. */
export async function resetPasswordWithTokenAction(token: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations("auth.errors");
  const password = str(fd, "password");
  if (password.length < 8) return { error: t("field.password") };
  if (password !== str(fd, "confirm")) return { error: t("passwordMismatch") };
  const userId = await consumeEmailToken(token, "reset");
  if (!userId) return { error: t("linkInvalid") };
  const user = await db.user.update({
    where: { id: userId },
    // The link came to their mailbox: the address is confirmed too.
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
  });
  await db.session.deleteMany({ where: { userId } });
  await audit(userId, "user.resetPassword", user.username);
  if (user.status !== "ACTIVE") redirect("/?reset=1");
  await createSession(userId);
  await rememberPreferences(user.locale, user.theme);
  redirect("/home?reset=1");
}

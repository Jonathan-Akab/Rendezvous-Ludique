"use server";

import { cookies } from "next/headers";
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
  if (user.status !== "ACTIVE") return { error: t("suspended") };

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

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations("auth.errors");
  const settings = await getSiteSettings();
  if (!settings.registrationOpen) return { error: t("registrationClosed") };

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

  const taken = await db.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
    select: { email: true },
  });
  if (taken) return { error: taken.email === data.email ? t("emailTaken") : t("usernameTaken") };

  // Bootstrap: the very first account on a fresh install becomes admin.
  const isFirst = (await db.user.count()) === 0;
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
    },
  });
  await createPersonalLibrary(user.id, user.displayName);
  await audit(user.id, "user.register", user.username, isFirst ? { bootstrapAdmin: true } : undefined);

  await createSession(user.id);
  await rememberPreferences(user.locale, user.theme);
  redirect("/home?welcome=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

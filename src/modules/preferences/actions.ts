"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";
import { LOCALE_COOKIE, LOCALES, THEME_COOKIE, type Locale, type ThemeKey } from "@/lib/constants";

const YEAR = 60 * 60 * 24 * 365;

export async function setThemeAction(theme: string) {
  const { enabledThemes } = await getSiteSettings();
  if (!enabledThemes.includes(theme as ThemeKey)) return;
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { theme } });
  revalidatePath("/", "layout");
}

export async function setLocaleAction(locale: string) {
  if (!LOCALES.includes(locale as Locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}

/** The member's own sidebar order (list of menu hrefs); an empty list resets to the default. */
export async function saveNavOrderAction(hrefs: string[]) {
  const user = await getCurrentUser();
  if (!user) return;
  const clean = hrefs.filter((h) => typeof h === "string" && /^\/[a-z-]*$/.test(h)).slice(0, 30);
  await db.user.update({ where: { id: user.id }, data: { navOrder: clean.length ? JSON.stringify(clean) : null } });
  revalidatePath("/", "layout");
}
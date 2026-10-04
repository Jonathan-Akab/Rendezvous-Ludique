"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getSiteSettings } from "@/lib/settings";
import { bool, HEX_COLOR, oneOf, optFloat, optStr, str, type ActionState } from "@/lib/forms";
import { LOCALE_COOKIE, LOCALES, THEME_COOKIE, VISIBILITIES, type ThemeKey } from "@/lib/constants";

const YEAR = 60 * 60 * 24 * 365;

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const t = await getTranslations("settings");
  const settings = await getSiteSettings();

  const displayName = str(fd, "displayName").slice(0, 60);
  if (!displayName) return { error: t("errors.displayName") };
  const meepleColor = str(fd, "meepleColor");
  const theme = str(fd, "theme");
  const locale = oneOf(str(fd, "locale"), LOCALES, user.locale as (typeof LOCALES)[number]);

  await db.user.update({
    where: { id: user.id },
    data: {
      displayName,
      bio: optStr(fd, "bio")?.slice(0, 1000) ?? null,
      city: optStr(fd, "city")?.slice(0, 80) ?? null,
      region: optStr(fd, "region")?.slice(0, 80) ?? null,
      latitude: optFloat(fd, "latitude"),
      longitude: optFloat(fd, "longitude"),
      favoriteGames: optStr(fd, "favoriteGames")?.slice(0, 300) ?? null,
      meepleColor: HEX_COLOR.test(meepleColor) ? meepleColor : user.meepleColor,
      theme: settings.enabledThemes.includes(theme as ThemeKey) ? theme : user.theme,
      locale,
      profileVisibility: oneOf(str(fd, "profileVisibility"), VISIBILITIES, "MEMBERS"),
      showLibrary: bool(fd, "showLibrary"),
      showPlays: bool(fd, "showPlays"),
    },
  });
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (settings.enabledThemes.includes(theme as ThemeKey)) jar.set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true, message: (await getTranslations({ locale, namespace: "settings" }))("saved") };
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const t = await getTranslations("settings.errors");
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(str(fd, "current"), full.passwordHash))) return { error: t("currentPassword") };
  const next = str(fd, "password");
  if (next.length < 8) return { error: t("passwordLength") };
  if (next !== str(fd, "confirm")) return { error: t("passwordMismatch") };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true, message: (await getTranslations("settings"))("passwordChanged") };
}

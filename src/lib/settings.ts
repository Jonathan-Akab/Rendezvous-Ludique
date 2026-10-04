import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { THEME_KEYS, type Locale, type ThemeKey } from "@/lib/constants";

// Site-wide settings managed from the admin console.
export type SiteSettings = {
  siteName: string;
  registrationOpen: boolean;
  announcement: string;
  defaultTheme: ThemeKey;
  defaultLocale: Locale;
  timeZone: string;
  enabledThemes: ThemeKey[];
  /** uploaded pictures (file ids) per theme key, plus "login" for the sign-in page */
  themeImages: Record<string, string>;
};

export const SITE_DEFAULTS: SiteSettings = {
  siteName: "Rendezvous Ludique",
  registrationOpen: true,
  announcement: "",
  defaultTheme: "system",
  defaultLocale: "fr",
  timeZone: "America/Toronto",
  enabledThemes: [...THEME_KEYS],
  themeImages: {},
};

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db.siteSetting.findMany();
  const stored: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      stored[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore malformed rows */
    }
  }
  const merged = { ...SITE_DEFAULTS, ...stored } as SiteSettings;
  // light/dark/system always stay available
  merged.enabledThemes = Array.from(new Set<ThemeKey>(["system", "light", "dark", ...merged.enabledThemes]));
  return merged;
});

export async function saveSiteSettings(patch: Partial<SiteSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
  }
}

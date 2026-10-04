import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Nunito } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";
import { THEME_COOKIE, type ThemeKey } from "@/lib/constants";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSiteSettings();
  return {
    title: { default: siteName, template: `%s · ${siteName}` },
    description: "Board game events, home games, libraries and play logs.",
    icons: { icon: "/meeple.svg" },
  };
}

/** Theme priority: member preference → cookie (visitors) → site default. */
async function resolveTheme() {
  const [user, settings, jar] = await Promise.all([getCurrentUser(), getSiteSettings(), cookies()]);
  const wanted = (user?.theme ?? jar.get(THEME_COOKIE)?.value ?? settings.defaultTheme) as ThemeKey;
  return { theme: settings.enabledThemes.includes(wanted) ? wanted : settings.defaultTheme, settings };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, { theme }] = await Promise.all([getLocale(), resolveTheme()]);
  return (
    <html lang={locale} data-theme={theme} className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

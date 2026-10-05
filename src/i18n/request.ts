import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/constants";
import { getSiteSettings } from "@/lib/settings";

// No locale in the URL: the language comes from a cookie (set at login and by the
// language switcher), falling back to the site default chosen by admins. Code can also ask
// for a given language (emails are written in the recipient's language).
export default getRequestConfig(async ({ locale: requested }) => {
  const [jar, settings] = await Promise.all([cookies(), getSiteSettings()]);
  const fromCookie = jar.get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale: Locale =
    requested && LOCALES.includes(requested as Locale) ? (requested as Locale) : fromCookie && LOCALES.includes(fromCookie) ? fromCookie : settings.defaultLocale;
  return {
    locale,
    timeZone: settings.timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

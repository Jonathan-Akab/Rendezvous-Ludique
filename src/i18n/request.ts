import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/constants";
import { getSiteSettings } from "@/lib/settings";

// No locale in the URL: the language comes from a cookie (set at login and by the
// language switcher), falling back to the site default chosen by admins.
export default getRequestConfig(async () => {
  const [jar, settings] = await Promise.all([cookies(), getSiteSettings()]);
  const fromCookie = jar.get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale: Locale = fromCookie && LOCALES.includes(fromCookie) ? fromCookie : settings.defaultLocale;
  return {
    locale,
    timeZone: settings.timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

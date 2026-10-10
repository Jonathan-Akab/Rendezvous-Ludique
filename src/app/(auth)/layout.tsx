import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";
import { TableScene } from "@/components/TableScene";
import { ThemePicture } from "@/components/ThemePicture";
import { LocaleSwitch, ThemePicker } from "@/components/PreferenceControls";
import { InstallApp } from "@/components/InstallApp";
import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/lib/constants";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/home");
  const settings = await getSiteSettings();
  const theme = (await cookies()).get(THEME_COOKIE)?.value ?? settings.defaultTheme;
  return (
    <div className="grain relative min-h-dvh overflow-hidden">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      {settings.themeImages.login ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/files/${settings.themeImages.login}`} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 [mask-image:linear-gradient(to_right,black_20%,transparent_90%)]" />
      ) : (
        <ThemePicture
          theme={theme}
          images={settings.themeImages}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30 [mask-image:radial-gradient(ellipse_at_30%_50%,black_25%,transparent_75%)]"
        />
      )}
      <TableScene />
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
        <InstallApp />
        <LocaleSwitch />
        <ThemePicker current={theme} enabled={settings.enabledThemes} images={settings.themeImages} />
      </div>
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-6xl items-center px-4 py-16">{children}</main>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/settings";
import { FadeIn } from "@/components/Motion";
import { PasswordForm, ProfileForm } from "@/modules/profiles/components/SettingsForms";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("settings") };
}

export default async function SettingsPage() {
  const [user, settings, t] = await Promise.all([requireUser(), getSiteSettings(), getTranslations("settings")]);
  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      <div className="card card-pad">
        <ProfileForm profile={user} enabledThemes={settings.enabledThemes} themeImages={settings.themeImages} />
      </div>
      <div className="card card-pad space-y-4">
        <h2 className="section-title">{t("security")}</h2>
        <PasswordForm />
      </div>
    </FadeIn>
  );
}

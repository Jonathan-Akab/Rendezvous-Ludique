import { getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { saveSiteSettingsAction } from "@/modules/admin/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("settings") };
}

export default async function AdminSettingsPage() {
  const [s, t] = await Promise.all([getSiteSettings(), getTranslations("admin.site")]);
  return (
    <div className="max-w-3xl space-y-6">
      <AdminHeader title={t("title")} lead={t("lead")} />
      <div className="card card-pad">
        <ActionForm action={saveSiteSettingsAction} submitLabel={t("save")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="siteName">
                {t("siteName")}
              </label>
              <input id="siteName" name="siteName" defaultValue={s.siteName} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="timeZone">
                {t("timeZone")}
              </label>
              <input id="timeZone" name="timeZone" defaultValue={s.timeZone} className="input" placeholder="America/Toronto" />
            </div>
            <div>
              <label className="label" htmlFor="defaultLocale">
                {t("defaultLocale")}
              </label>
              <select id="defaultLocale" name="defaultLocale" defaultValue={s.defaultLocale} className="select">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="announcement">
              {t("announcement")}
            </label>
            <input id="announcement" name="announcement" defaultValue={s.announcement} className="input" maxLength={300} />
            <p className="mt-1 text-xs text-muted">{t("announcementHint")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="registrationOpen" defaultChecked={s.registrationOpen} className="size-4 accent-[var(--accent)]" />
            {t("registrationOpen")}
          </label>
        </ActionForm>
      </div>
    </div>
  );
}

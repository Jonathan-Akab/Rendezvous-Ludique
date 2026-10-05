import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/settings";
import { ActionForm } from "@/components/ActionForm";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { saveSiteSettingsAction, sendTestEmailAction } from "@/modules/admin/actions";
import { mailConfigured } from "@/lib/mail";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("settings") };
}

export default async function AdminSettingsPage() {
  await requirePermission("settings");
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="registrationApproval" defaultChecked={s.registrationApproval} className="size-4 accent-[var(--accent)]" />
            {t("registrationApproval")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requireEmailConfirmation" defaultChecked={s.requireEmailConfirmation} className="size-4 accent-[var(--accent)]" />
            {t("requireEmailConfirmation")}
          </label>
          <div className="max-w-xs">
            <label className="label" htmlFor="minimumAge">
              {t("minimumAge")}
            </label>
            <input id="minimumAge" name="minimumAge" type="number" min={18} max={99} defaultValue={s.minimumAge} className="input" />
            <p className="mt-1 text-xs text-muted">{t("minimumAgeHint")}</p>
          </div>
        </ActionForm>
      </div>

      {/* Email (SMTP in .env) */}
      <div className="card card-pad space-y-3">
        <h2 className="section-title">{t("mailTitle")}</h2>
        <p className="text-sm text-muted">{mailConfigured() ? t("mailOn", { from: process.env.MAIL_FROM ?? "" }) : t("mailOff")}</p>
        {mailConfigured() && <ActionForm action={sendTestEmailAction} submitLabel={t("testMail")} submitClassName="btn btn-secondary"><span /></ActionForm>}
      </div>
    </div>
  );
}

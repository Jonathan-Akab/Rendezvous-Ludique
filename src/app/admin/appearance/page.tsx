import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/settings";
import { THEMES } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { ThemePicture } from "@/components/ThemePicture";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { removeThemeImageAction, saveAppearanceAction, saveThemeImageAction } from "@/modules/admin/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("appearance") };
}

const ALWAYS_ON = ["system", "light", "dark"];

export default async function AdminAppearancePage() {
  await requirePermission("appearance");
  const [settings, t, tt] = await Promise.all([getSiteSettings(), getTranslations("admin.appearance"), getTranslations("themes")]);
  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} lead={t("lead")} />
      <div className="card card-pad">
        <ActionForm action={saveAppearanceAction} submitLabel={t("save")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {THEMES.map((th) => {
              const always = ALWAYS_ON.includes(th.key);
              return (
                <div key={th.key} data-theme={th.key === "system" ? undefined : th.key} className="overflow-hidden rounded-xl border-2 border-line bg-bg text-ink">
                  <ThemePicture theme={th.key} images={settings.themeImages} className="block aspect-video w-full" />
                  <div className="space-y-2 bg-surface p-3">
                    <p className="font-display font-bold">{tt(th.key)}</p>
                    <div className="flex gap-1">
                      <span className="btn btn-primary btn-sm pointer-events-none">Aa</span>
                      <span className="chip">meeple</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" name="enabledThemes" value={th.key} defaultChecked={always || settings.enabledThemes.includes(th.key)} disabled={always} className="accent-[var(--accent)]" />
                      {always ? t("alwaysOn") : t("enabled")}
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="radio" name="defaultTheme" value={th.key} defaultChecked={settings.defaultTheme === th.key} className="accent-[var(--accent)]" />
                      {t("default")}
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </ActionForm>
      </div>

      <section className="card card-pad space-y-4">
        <div>
          <h2 className="section-title">{t("pictures")}</h2>
          <p className="text-sm text-muted">{t("picturesLead")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["login", ...THEMES.map((th) => th.key)].map((key) => {
            const has = Boolean(settings.themeImages[key]);
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-line">
                <div className="relative aspect-video bg-surface-2">
                  {key === "login" && !has ? (
                    <div className="grid h-full place-items-center p-4 text-center text-xs text-muted">{t("loginDefault")}</div>
                  ) : (
                    <ThemePicture theme={key} images={settings.themeImages} className="h-full w-full" />
                  )}
                  {has && <span className="chip-accent chip absolute left-2 top-2">{t("custom")}</span>}
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-sm font-bold">{key === "login" ? t("loginPicture") : tt(key)}</p>
                  <ActionForm action={saveThemeImageAction.bind(null, key)} submitLabel={has ? t("replace") : t("upload")} submitClassName="btn btn-secondary btn-sm" className="space-y-2">
                    <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="w-full text-xs" />
                  </ActionForm>
                  {has && (
                    <form action={removeThemeImageAction.bind(null, key)}>
                      <button className="text-xs text-muted underline hover:text-danger">{t("removePicture")}</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">{t("picturesRights")}</p>
      </section>
    </div>
  );
}

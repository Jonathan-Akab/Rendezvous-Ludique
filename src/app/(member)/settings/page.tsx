import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { getSiteSettings } from "@/lib/settings";
import { FadeIn } from "@/components/Motion";
import { PasswordForm, ProfileForm } from "@/modules/profiles/components/SettingsForms";
import { MenuOrderSettings } from "@/components/shell/MenuOrderSettings";
import { getMenuItems } from "@/lib/menu";
import { getModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { ConfirmButton } from "@/components/forms";
import { OwnKeyForm } from "@/modules/ai/components/OwnKeyForm";
import { ownKeysAllowed, ownSpendSince } from "@/modules/ai/ownKey";
import { monthStart } from "@/modules/ai/policy";
import { removeOwnKeyAction } from "@/modules/ai/actions";
import { mailConfigured } from "@/lib/mail";
import { NOTIFY_TYPES, parseNotifyPrefs } from "@/modules/notifications/emails";
import { NotifyPrefsForm } from "@/modules/notifications/components/NotifyPrefsForm";
import { ReplayGuideButton } from "@/modules/guide/components/SiteGuide";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("settings") };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, t, tn, menu, aiMod] = await Promise.all([getSiteSettings(), getTranslations("settings"), getTranslations("nav"), getMenuItems(user.navOrder), getModule("ai")]);
  // "Use my Claude credits" (rules AI)
  const ownAllowed = ownKeysAllowed(aiMod);
  const own = ownAllowed ? await db.aiMemberSetting.findUnique({ where: { userId: user.id }, select: { ownKeyHint: true, ownModel: true } }) : null;
  const ownSpend = own?.ownKeyHint ? await ownSpendSince(user.id, await monthStart()) : null;
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
        <div>
          <h2 className="section-title">{tn("menuOrder")}</h2>
          <p className="text-sm text-muted">{tn("menuOrderLead")}</p>
        </div>
        <MenuOrderSettings items={menu} />
      </div>
      <div className="card card-pad flex flex-wrap items-center gap-4">
        <div className="min-w-56 flex-1">
          <h2 className="section-title">{t("guide.title")}</h2>
          <p className="text-sm text-muted">{t("guide.lead")}</p>
        </div>
        <ReplayGuideButton label={t("guide.replay")} />
      </div>
      {/* Email notifications (opt-in) */}
      <div id="notifications" className="card card-pad scroll-mt-24 space-y-4">
        <div>
          <h2 className="section-title">{t("notifications.title")}</h2>
          <p className="text-sm text-muted">
            {!mailConfigured() ? t("notifications.mailOff") : user.emailVerifiedAt ? t("notifications.lead", { email: user.email }) : t("notifications.unverified")}
          </p>
        </div>
        {mailConfigured() && <NotifyPrefsForm types={NOTIFY_TYPES} enabled={[...parseNotifyPrefs(user.notifyPrefs)]} />}
      </div>
      {ownAllowed && (
        <div id="own-key" className="card card-pad scroll-mt-24 space-y-4">
          <div>
            <h2 className="section-title">{t("ownKey.title")}</h2>
            <p className="text-sm text-muted">{t("ownKey.lead")}</p>
          </div>
          {own?.ownKeyHint ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-success/10 px-4 py-3 text-sm">
              <span className="flex-1">
                <span className="block font-semibold text-success">{t("ownKey.active", { hint: own.ownKeyHint })}</span>
                {ownSpend && <span className="text-xs text-muted">{t("ownKey.spend", { usd: ownSpend.usd.toFixed(2), count: ownSpend.answers })}</span>}
              </span>
              <form action={removeOwnKeyAction}>
                <ConfirmButton message={t("ownKey.removeConfirm")} className="btn btn-ghost btn-sm text-danger">
                  {t("ownKey.remove")}
                </ConfirmButton>
              </form>
            </div>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>{t("ownKey.step1")}</li>
              <li>{t("ownKey.step2")}</li>
              <li>{t("ownKey.step3")}</li>
            </ol>
          )}
          <OwnKeyForm hint={own?.ownKeyHint ?? null} model={own?.ownModel ?? null} />
          <p className="text-xs text-muted">{t("ownKey.privacy")}</p>
        </div>
      )}
      <div className="card card-pad space-y-4">
        <h2 className="section-title">{t("security")}</h2>
        <PasswordForm />
      </div>
    </FadeIn>
  );
}

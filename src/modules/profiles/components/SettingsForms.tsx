"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { FormMessage, SubmitButton } from "@/components/forms";
import { LocationFields } from "@/components/LocationFields";
import { THEMES, VISIBILITIES, type ThemeKey } from "@/lib/constants";
import { MeepleColorPicker } from "./MeepleColorPicker";
import { ThemePicture } from "@/components/ThemePicture";
import { changePasswordAction, updateProfileAction } from "../actions";

type Profile = {
  displayName: string;
  bio: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  favoriteGames: string | null;
  meepleColor: string;
  theme: string;
  locale: string;
  profileVisibility: string;
  showLibrary: boolean;
  showPlays: boolean;
};

export function ProfileForm({ profile, enabledThemes, themeImages }: { profile: Profile; enabledThemes: ThemeKey[]; themeImages?: Record<string, string> }) {
  const t = useTranslations("settings");
  const tt = useTranslations("themes");
  const tp = useTranslations("profile.visibility");
  const [state, action] = useActionState(updateProfileAction, undefined);
  const [theme, setTheme] = useState(profile.theme);

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="section-title">{t("meeple")}</h2>
        <MeepleColorPicker defaultValue={profile.meepleColor} />
      </section>

      <section className="space-y-4">
        <h2 className="section-title">{t("about")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="displayName">
              {t("displayName")}
            </label>
            <input id="displayName" name="displayName" className="input" defaultValue={profile.displayName} required maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="favoriteGames">
              {t("favoriteGames")}
            </label>
            <input id="favoriteGames" name="favoriteGames" className="input" defaultValue={profile.favoriteGames ?? ""} placeholder="Catan, Anachrony, Merchants Cove" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bio">
            {t("bio")}
          </label>
          <textarea id="bio" name="bio" className="textarea" defaultValue={profile.bio ?? ""} maxLength={1000} placeholder={t("bioPlaceholder")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="city">
              {t("city")}
            </label>
            <input id="city" name="city" className="input" defaultValue={profile.city ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="region">
              {t("region")}
            </label>
            <input id="region" name="region" className="input" defaultValue={profile.region ?? ""} />
          </div>
        </div>
        <div>
          <span className="label">{t("location")}</span>
          <LocationFields latitude={profile.latitude} longitude={profile.longitude} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">{t("privacy")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {VISIBILITIES.map((v) => (
            <label key={v} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
              <input type="radio" name="profileVisibility" value={v} defaultChecked={profile.profileVisibility === v} className="mt-1 accent-[var(--accent)]" />
              <span>
                <span className="block text-sm font-semibold">{tp(v)}</span>
                <span className="block text-xs text-muted">{t(`visibilityHint.${v}`)}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="showLibrary" defaultChecked={profile.showLibrary} className="size-4 accent-[var(--accent)]" />
          {t("showLibrary")}
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="showPlays" defaultChecked={profile.showPlays} className="size-4 accent-[var(--accent)]" />
          {t("showPlays")}
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">{t("appearance")}</h2>
        <input type="hidden" name="theme" value={theme} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {THEMES.filter((th) => enabledThemes.includes(th.key)).map((th) => (
            <button
              type="button"
              key={th.key}
              aria-pressed={theme === th.key}
              onClick={() => {
                setTheme(th.key);
                document.documentElement.dataset.theme = th.key; // live preview
              }}
              className={`overflow-hidden rounded-xl border-2 text-left text-xs font-semibold transition hover:-translate-y-0.5 ${
                theme === th.key ? "border-accent" : "border-line"
              }`}
            >
              <span className="block aspect-video overflow-hidden">
                <ThemePicture theme={th.key} images={themeImages} className="h-full w-full transition duration-500 hover:scale-110" />
              </span>
              <span className="block bg-surface px-2 py-1.5">{tt(th.key)}</span>
            </button>
          ))}
        </div>
        <div className="w-48">
          <label className="label" htmlFor="locale">
            {t("language")}
          </label>
          <select id="locale" name="locale" className="select" defaultValue={profile.locale}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-2xl border border-line bg-surface/90 p-3 backdrop-blur md:bottom-4">
        <SubmitButton>{t("save")}</SubmitButton>
        <div className="flex-1">
          <FormMessage state={state} />
        </div>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings");
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="current">
            {t("currentPassword")}
          </label>
          <input id="current" name="current" type="password" className="input" required autoComplete="current-password" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t("newPassword")}
          </label>
          <input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            {t("confirmPassword")}
          </label>
          <input id="confirm" name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary">{t("changePassword")}</SubmitButton>
    </form>
  );
}

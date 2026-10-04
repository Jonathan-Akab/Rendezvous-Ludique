"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FormMessage, SubmitButton } from "@/components/forms";
import { MeepleColorPicker } from "@/modules/profiles/components/MeepleColorPicker";
import { loginAction, registerAction } from "../actions";

export function LoginForm({ next = "", registrationOpen }: { next?: string; registrationOpen: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="identifier">
          {t("identifier")}
        </label>
        <input id="identifier" name="identifier" className="input" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t("password")}
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full py-3 text-base" pendingLabel={t("signingIn")}>
        {t("signIn")}
      </SubmitButton>
      {registrationOpen && (
        <p className="text-center text-sm text-muted">
          {t("noAccount")}{" "}
          <Link href="/register" className="link">
            {t("joinTable")}
          </Link>
        </p>
      )}
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <span className="label">{t("chooseMeeple")}</span>
        <MeepleColorPicker />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="displayName">
            {t("displayName")}
          </label>
          <input id="displayName" name="displayName" className="input" required maxLength={60} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="username">
            {t("username")}
          </label>
          <input
            id="username"
            name="username"
            className="input"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_\-]+"
            autoComplete="username"
          />
          <p className="mt-1 text-xs text-muted">{t("usernameHint")}</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="email">
          {t("email")}
        </label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">
            {t("password")}
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
      <SubmitButton className="btn btn-primary w-full py-3 text-base" pendingLabel={t("creating")}>
        {t("createAccount")}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/" className="link">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { MeepleColorPicker } from "@/modules/profiles/components/MeepleColorPicker";
import { forgotPasswordAction, loginAction, registerAction, resendVerificationAction, resetPasswordWithTokenAction } from "../actions";

export function LoginForm({ next = "", registrationOpen, mailOn }: { next?: string; registrationOpen: boolean; mailOn: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(loginAction, undefined);
  const [resent, setResent] = useState<string | null>(null);
  const [resending, startResend] = useTransition();
  const resendFor = typeof state?.data?.resend === "string" ? state.data.resend : null;
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
        {mailOn && (
          <p className="mt-1 text-right text-xs">
            <Link href="/forgot-password" className="link">
              {t("forgot")}
            </Link>
          </p>
        )}
      </div>
      <FormMessage state={state} />
      {/* not confirmed yet: send the link again */}
      {resendFor && (
        <button
          type="button"
          disabled={resending || Boolean(resent)}
          onClick={() => startResend(async () => setResent((await resendVerificationAction(resendFor))?.message ?? null))}
          className="btn btn-secondary btn-sm w-full"
        >
          {resent ?? t("resendVerify")}
        </button>
      )}
      <SubmitButton className="btn btn-primary w-full py-3 text-base" pendingLabel={t("signingIn")}>
        {t("signIn")}
      </SubmitButton>
      {registrationOpen && (
        <div className="space-y-2 border-t border-line/60 pt-4 text-center">
          <p className="text-sm text-muted">{t("noAccount")}</p>
          <Link href="/register" className="btn btn-secondary w-full py-2.5">
            <UserPlus className="size-4" /> {t("becomeMember")}
          </Link>
        </div>
      )}
    </form>
  );
}

export function RegisterForm({ approval, minimumAge }: { approval: boolean; minimumAge: number }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(registerAction, undefined);
  // when the form appeared (bots submit instantly)
  const [startedAt] = useState(() => Date.now());
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* left empty by people, filled by bots */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
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
      <div className="grid gap-4 sm:grid-cols-[1fr_190px]">
        <div>
          <label className="label" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="birthDate">
            {t("birthDate")}
          </label>
          <input id="birthDate" name="birthDate" type="date" className="input" required max={latestBirthDate(minimumAge)} min="1900-01-01" autoComplete="bday" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">{t("ageHint", { age: minimumAge })}</p>
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
      {/* only when the team approves sign-ups: helps them recognise the person */}
      {approval && (
        <div>
          <label className="label" htmlFor="signupNote">
            {t("signupNote")}
          </label>
          <textarea id="signupNote" name="signupNote" className="textarea min-h-20" maxLength={500} required minLength={10} placeholder={t("signupNotePlaceholder")} />
          <p className="mt-1 text-xs text-muted">{t("approvalHint")}</p>
        </div>
      )}
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

/** The latest birth date allowed for this minimum age (yyyy-mm-dd). */
function latestBirthDate(age: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

/** "Forgot my password": asks for the email or username and sends a link. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="identifier">
          {t("identifier")}
        </label>
        <input id="identifier" name="identifier" className="input" autoComplete="username" required autoFocus />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full py-3" pendingLabel={t("sending")}>
        {t("sendResetLink")}
      </SubmitButton>
    </form>
  );
}

/** New password, from the emailed link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resetPasswordWithTokenAction.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">
          {t("newPassword")}
        </label>
        <input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          {t("confirmPassword")}
        </label>
        <input id="confirm" name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full py-3">{t("savePassword")}</SubmitButton>
    </form>
  );
}

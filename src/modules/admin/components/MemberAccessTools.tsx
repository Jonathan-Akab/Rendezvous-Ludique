"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import type { ActionState } from "@/lib/forms";
import { sendPasswordResetEmailAction, sendVerificationEmailAction, verifyMemberAction } from "../actions";

/**
 * How a member gets in: let them in by hand (verified + active), send the confirmation email again,
 * or send a password-reset email. Each button says what happened right under it.
 */
export function MemberAccessTools({
  userId,
  verified,
  pending,
  suspended,
  mailOn,
}: {
  userId: string;
  /** the member's email address is confirmed */
  verified: boolean;
  /** the account waits for an admin's approval */
  pending: boolean;
  suspended: boolean;
  /** the site can send email (SMTP is set up) */
  mailOn: boolean;
}) {
  const t = useTranslations("admin.members.access");
  const [pendingCall, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const [result, setResult] = useState<ActionState>(undefined);

  const run = (key: string, call: () => Promise<ActionState>) => {
    setWhich(key);
    setResult(undefined);
    start(async () => {
      try {
        setResult(await call());
      } catch {
        setResult({ error: t("failed") });
      } finally {
        setWhich(null);
      }
    });
  };

  const button = (key: string, icon: React.ReactNode, label: string, call: () => Promise<ActionState>, opts: { primary?: boolean; needsMail?: boolean; disabled?: boolean } = {}) => (
    <button
      type="button"
      onClick={() => run(key, call)}
      disabled={pendingCall || opts.disabled || (opts.needsMail && !mailOn)}
      className={`btn ${opts.primary ? "btn-primary" : "btn-secondary"} btn-sm w-full justify-start`}
    >
      {pendingCall && which === key ? <LoaderCircle className="size-4 animate-spin" /> : icon} {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm">
        {verified ? <span className="text-success">{t("emailVerified")}</span> : <span className="text-[#c78f1f]">{t("emailNotVerified")}</span>}
        {" · "}
        <span className={pending ? "text-[#c78f1f]" : suspended ? "text-danger" : "text-success"}>{pending ? t("waiting") : suspended ? t("suspended") : t("active")}</span>
      </p>

      {(!verified || pending) && button("verify", <ShieldCheck className="size-4" />, t("verify"), () => verifyMemberAction(userId), { primary: true })}
      {!verified && button("resend", <MailCheck className="size-4" />, t("resendConfirmation"), () => sendVerificationEmailAction(userId), { needsMail: true })}
      {button("reset", <KeyRound className="size-4" />, t("sendReset"), () => sendPasswordResetEmailAction(userId), { needsMail: true, disabled: suspended })}

      {!mailOn && <p className="text-xs text-muted">{t("mailOff")}</p>}
      {result?.ok && <p role="status" className="text-xs text-success">{result.message}</p>}
      {result?.error && <p role="status" className="text-xs text-danger">{result.error}</p>}
      <p className="text-xs text-muted">{t("hint")}</p>
    </div>
  );
}

import "server-only";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { appUrl, emailLayout, mailConfigured, sendMail } from "@/lib/mail";
import { getSiteSettings } from "@/lib/settings";
import { createEmailToken } from "@/lib/auth/emailTokens";

// Every email the site sends, written in the recipient's language.

/** Notifications a member can turn on in their settings (all off by default). */
export const NOTIFY_TYPES = [
  "friendRequest",
  "playToConfirm",
  "eventJoinRequest",
  "eventJoinAccepted",
  "eventCancelled",
  "kallaxInvite",
  "bazaarMessage",
  "suggestionUpdate",
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

export function parseNotifyPrefs(raw: string | null): Set<NotifyType> {
  try {
    const list = raw ? JSON.parse(raw) : [];
    return new Set((Array.isArray(list) ? list : []).filter((x): x is NotifyType => (NOTIFY_TYPES as readonly string[]).includes(x)));
  } catch {
    return new Set();
  }
}

type Recipient = { id: string; email: string; displayName: string; locale: string };

async function base(user: Recipient) {
  const [settings, t] = await Promise.all([getSiteSettings(), getTranslations({ locale: user.locale, namespace: "email" })]);
  return { siteName: settings.siteName, t };
}

/** "Confirm your email address" with a link valid 48 hours. */
export async function sendVerificationEmail(user: Recipient) {
  const { siteName, t } = await base(user);
  const token = await createEmailToken(user.id, "verify");
  const { html, text } = emailLayout({
    siteName,
    title: t("verify.title", { name: user.displayName }),
    paragraphs: [t("verify.body", { site: siteName }), t("verify.expires")],
    button: { label: t("verify.button"), url: `${appUrl()}/verify-email?token=${token}` },
    footer: t("verify.footer"),
  });
  await sendMail({ to: user.email, subject: t("verify.subject", { site: siteName }), html, text });
}

/** "Reset your password" with a link valid one hour. */
export async function sendPasswordResetEmail(user: Recipient) {
  const { siteName, t } = await base(user);
  const token = await createEmailToken(user.id, "reset");
  const { html, text } = emailLayout({
    siteName,
    title: t("reset.title", { name: user.displayName }),
    paragraphs: [t("reset.body"), t("reset.expires")],
    button: { label: t("reset.button"), url: `${appUrl()}/reset-password?token=${token}` },
    footer: t("reset.footer"),
  });
  await sendMail({ to: user.email, subject: t("reset.subject", { site: siteName }), html, text });
}

/**
 * A notification email — only if the member turned this kind on, confirmed their address,
 * and email is set up. Never fails the action that triggered it.
 */
export async function notify(userId: string, type: NotifyType, params: Record<string, string>, path: string) {
  try {
    if (!mailConfigured()) return;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt || !parseNotifyPrefs(user.notifyPrefs).has(type)) return;
    const { siteName, t } = await base(user);
    const { html, text } = emailLayout({
      siteName,
      title: t(`notify.${type}.title`, params),
      paragraphs: [t(`notify.${type}.body`, params)],
      button: { label: t("notify.open"), url: `${appUrl()}${path}` },
      footer: t("notify.footer", { url: `${appUrl()}/settings#notifications` }),
    });
    await sendMail({ to: user.email, subject: t(`notify.${type}.title`, params), html, text });
  } catch (e) {
    console.error(`[notify] ${type} to ${userId} failed:`, e);
  }
}

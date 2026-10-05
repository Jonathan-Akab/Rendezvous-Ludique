"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, HeartHandshake } from "lucide-react";
import { Popup, PopupBullets } from "@/components/Popup";

// "Soutenir le projet": a short explanation of who pays for the site, then the donation page
// (when an admin has configured one). Opened from the top bar, the footer or the AI notice.

const OPEN_EVENT = "rl:open-donate";
export function openDonate() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Mounted once in the member layout. */
export function DonateDialog({ url, transferEmail }: { url: string; transferEmail: string }) {
  const t = useTranslations("donations");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(transferEmail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  return (
    <Popup open={open} onClose={close} title={t("popup.title")} icon={<HeartHandshake className="size-5" />} closeLabel={t("popup.later")}>
      <PopupBullets items={[t("popup.b1"), t("popup.b2"), t("popup.b3")]} />
      {transferEmail && (
        <div className="space-y-1.5 rounded-2xl bg-accent/10 px-4 py-3 text-sm">
          <p className="font-semibold">{t("popup.transfer")}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-semibold text-accent">{transferEmail}</code>
            <button type="button" onClick={copy} className="btn btn-ghost btn-sm" title={t("popup.copy")}>
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              <span className="sr-only">{t("popup.copy")}</span>
            </button>
          </div>
        </div>
      )}
      <p className="text-sm text-muted">{t("popup.thanks")}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className="btn btn-ghost btn-sm">
          {t("popup.later")}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={close} className="btn btn-primary btn-sm">
            <HeartHandshake className="size-4" aria-hidden />
            {t("popup.give")}
          </a>
        )}
      </div>
    </Popup>
  );
}

/** Opens the popup (top bar, footer…). */
export function DonateTrigger({ placement, label }: { placement: "top" | "footer"; label: string }) {
  if (placement === "footer") {
    return (
      <button type="button" onClick={openDonate} className="inline-flex items-center gap-1 hover:text-accent">
        <HeartHandshake className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openDonate}
      data-guide="donate"
      title={label}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line/70 px-2 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent sm:px-3"
    >
      <HeartHandshake className="size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

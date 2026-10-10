"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, MonitorDown, Package, Share, Smartphone } from "lucide-react";
import { Popup, PopupBullets } from "@/components/Popup";

// "Installer l'application": the site as an app on the phone or the computer (no store).
// Chrome / Edge / Samsung hand us an install prompt; iPhone / iPad and the other browsers get
// the steps to follow. Hidden once the site already runs as an installed app.

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "ios" | "android" | "desktop";

function platform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with a touch screen
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

const installed = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Package with a downward arrow. */
function InstallIcon() {
  return (
    <span className="relative inline-flex">
      <Package className="size-4" aria-hidden />
      <span className="absolute -bottom-1 -right-1.5 grid size-3 place-items-center rounded-full bg-accent text-accent-ink">
        <ArrowDown className="size-2.5" strokeWidth={3} aria-hidden />
      </span>
    </span>
  );
}

export function InstallApp() {
  const t = useTranslations("install");
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [help, setHelp] = useState<Platform | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) void navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (installed()) return;
    setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own button
      setPrompt(e as PromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);
      if (outcome === "accepted") setHidden(true);
      return;
    }
    setHelp(platform());
  };

  const steps: Record<Platform, string[]> = {
    ios: [t("ios.b1"), t("ios.b2"), t("ios.b3")],
    android: [t("android.b1"), t("android.b2"), t("android.b3")],
    desktop: [t("desktop.b1"), t("desktop.b2"), t("desktop.b3")],
  };
  const icons: Record<Platform, React.ReactNode> = {
    ios: <Share className="size-5" />,
    android: <Smartphone className="size-5" />,
    desktop: <MonitorDown className="size-5" />,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        title={t("button")}
        data-guide="install"
        className="inline-flex items-center gap-1.5 rounded-xl border border-line/70 px-2 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent sm:px-3"
      >
        <InstallIcon />
        <span className="hidden whitespace-nowrap xl:inline">{t("button")}</span>
      </button>
      {help && (
        <Popup open onClose={() => setHelp(null)} title={t(`${help}.title`)} icon={icons[help]} closeLabel={t("close")}>
          <p className="text-sm text-muted">{t("lead")}</p>
          <PopupBullets items={steps[help]} />
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setHelp(null)}>
              {t("close")}
            </button>
          </div>
        </Popup>
      )}
    </>
  );
}

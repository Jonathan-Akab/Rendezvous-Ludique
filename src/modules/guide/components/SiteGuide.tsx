"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { finishGuideAction } from "../actions";
import { GuideOverlay } from "./GuideOverlay";

// Welcome tour: a game pawn walks from one part of the site to the next, with a short
// bullet-point bubble at each stop. Shown at the first sign-in (and at the next one when
// the member asks), and from Paramètres → "Revoir le guide".

const OPEN_EVENT = "rl:open-guide";
export function openGuide() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Step = { key: string; target?: string; module?: string; donate?: boolean; bullets: number };

// target: a [data-guide] element; module: only when that menu entry exists.
const STEPS: Step[] = [
  { key: "welcome", bullets: 3 },
  { key: "menu", target: "menu", bullets: 3 },
  { key: "home", target: "nav-home", bullets: 3 },
  { key: "events", target: "nav-events", module: "/events", bullets: 4 },
  { key: "kallax", target: "nav-kallax", module: "/kallax", bullets: 3 },
  { key: "plays", target: "nav-plays", module: "/plays", bullets: 4 },
  { key: "picker", target: "nav-picker", module: "/picker", bullets: 4 },
  { key: "ai", target: "nav-ai", module: "/ai", bullets: 4 },
  { key: "more", target: "menu", bullets: 4 },
  { key: "search", target: "search", bullets: 2 },
  { key: "prefs", target: "prefs", bullets: 4 },
  { key: "account", target: "account", bullets: 2 },
  { key: "suggestions", target: "nav-suggestions", module: "/suggestions", bullets: 2 },
  { key: "donate", target: "donate", donate: true, bullets: 3 },
  { key: "end", bullets: 2 },
];

export function SiteGuide({ autoStart, name, menu, donate }: { autoStart: boolean; name: string; menu: string[]; donate: boolean }) {
  const t = useTranslations("guide");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [showNext, setShowNext] = useState(false);

  const steps = STEPS.filter((s) => (!s.module || menu.includes(s.module)) && (!s.donate || donate));
  const step = steps[index];

  // First sign-in: start once the page (and its transition) has settled.
  useEffect(() => {
    const start = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, start);
    const timer = autoStart ? setTimeout(start, 1400) : undefined;
    return () => {
      window.removeEventListener(OPEN_EVENT, start);
      if (timer) clearTimeout(timer);
    };
  }, [autoStart]);

  const close = useCallback(() => {
    setOpen(false);
    void finishGuideAction(showNext);
  }, [showNext]);
  const next = useCallback(() => (index < steps.length - 1 ? setIndex(index + 1) : close()), [index, steps.length, close]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  if (!step) return null;
  const params = { name };
  return (
    <GuideOverlay
      open={open}
      stepKey={step.key}
      index={index}
      total={steps.length}
      title={t(`steps.${step.key}.title`, params)}
      bullets={Array.from({ length: step.bullets }, (_, i) => t(`steps.${step.key}.b${i + 1}`, params))}
      target={step.target}
      labels={{ progress: t("progress", { n: index + 1, total: steps.length }), skip: t("skip"), next: t("next"), previous: t("previous"), finish: t("finish") }}
      footer={
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showNext} onChange={(e) => setShowNext(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />
          {t("showNext")}
        </label>
      }
      onNext={next}
      onPrev={prev}
      onClose={close}
    />
  );
}

/** "Revoir le guide" (settings page). */
export function ReplayGuideButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={openGuide} className="btn btn-secondary">
      {label}
    </button>
  );
}

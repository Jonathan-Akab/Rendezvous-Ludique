"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

// Turns the board-game page transitions on or off (remembered on this device).

const KEY = "rl-animations";
const EVENT = "rl:animations";

/** Whether page transitions are on (default: on). */
export function animationsOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function AnimationToggle() {
  const t = useTranslations("nav");
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(animationsOn());
    const sync = () => setOn(animationsOn());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !on;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* storage unavailable: applies to this page only */
    }
    setOn(next);
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? t("animationsOn") : t("animationsOff")}
      aria-label={on ? t("animationsOn") : t("animationsOff")}
      data-guide="animations"
      className="relative grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      <Sparkles className={`size-[18px] ${on ? "text-accent" : ""}`} />
      {/* a slash when off */}
      {!on && <span className="absolute h-[2px] w-5 rotate-45 rounded-full bg-current" aria-hidden />}
    </button>
  );
}

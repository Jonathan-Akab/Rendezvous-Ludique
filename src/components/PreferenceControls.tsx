"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { TapAway } from "@/components/TapAway";
import { Palette } from "lucide-react";
import { setLocaleAction, setThemeAction } from "@/modules/preferences/actions";
import { THEMES, type ThemeKey } from "@/lib/constants";
import { ThemePicture } from "./ThemePicture";

export function ThemePicker({
  current,
  enabled,
  placement = "down",
  images,
}: {
  current: string;
  enabled: ThemeKey[];
  placement?: "up" | "down";
  images?: Record<string, string>;
}) {
  const t = useTranslations("themes");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(current);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const pick = (key: string) => {
    document.documentElement.dataset.theme = key; // instant feedback
    setSelected(key);
    setOpen(false);
    startTransition(() => setThemeAction(key));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={t("pick")}
      >
        <Palette className="size-4" aria-hidden />
        <span className="sr-only">{t("pick")}</span>
      </button>
      {open && <TapAway onClose={() => setOpen(false)} />}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`glass absolute z-50 w-72 rounded-2xl p-2 ${placement === "up" ? "bottom-full left-0 mb-2" : "right-0 mt-2"}`}
          >
            {THEMES.filter((th) => enabled.includes(th.key)).map((th) => (
              <button
                key={th.key}
                role="menuitemradio"
                aria-checked={selected === th.key}
                onClick={() => pick(th.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${
                  selected === th.key ? "font-semibold text-accent" : ""
                }`}
              >
                <span className="block h-9 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                  <ThemePicture theme={th.key} images={images} className="h-full w-full" />
                </span>
                {t(th.key)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** FR | EN switch: the pill sits on the language the site is shown in; a tap moves it. */
export function LocaleSwitch() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  // the pill moves right away; the page follows once the new language is loaded
  const [shown, setShown] = useState(locale);
  useEffect(() => setShown(locale), [locale]);
  const next = shown === "fr" ? "en" : "fr";
  const label = (l: string) => (l === "fr" ? "Français" : "English");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown === "en"}
      aria-label={`${label(shown)} → ${label(next)}`}
      title={label(next)}
      disabled={pending}
      onClick={() => {
        setShown(next);
        startTransition(() => setLocaleAction(next));
      }}
      className="relative grid h-8 shrink-0 grid-cols-2 items-center rounded-full border border-line/70 bg-surface-2/70 p-0.5 text-[11px] font-bold disabled:opacity-80"
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-accent shadow"
        initial={false}
        animate={{ x: shown === "fr" ? 0 : "100%" }}
        transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
      />
      {(["fr", "en"] as const).map((l) => (
        <span key={l} className={`relative z-10 w-8 text-center uppercase transition-colors ${shown === l ? "text-accent-ink" : "text-muted"}`}>
          {l}
        </span>
      ))}
    </button>
  );
}

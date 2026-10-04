"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Languages, Palette } from "lucide-react";
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
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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

export function LocaleSwitch() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm uppercase"
      disabled={pending}
      onClick={() => startTransition(() => setLocaleAction(next))}
      title={next === "en" ? "English" : "Français"}
    >
      <Languages className="size-4" aria-hidden />
      {next}
    </button>
  );
}

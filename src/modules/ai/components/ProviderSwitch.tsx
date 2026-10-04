"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { AlertTriangle, BookOpen, Check, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { setAiProviderAction } from "../actions";

export type ProviderInfo = {
  claudeAvailable: boolean;
  claudeReason: string | null;
  freeAvailable: boolean;
  freeName: string;
  budgetUsedPct: number | null;
};

/** Claude (precise) vs the free option, with a warning before switching to free. */
export function ProviderSwitch({
  value,
  onChange,
  info,
}: {
  value: "claude" | "free";
  onChange: (p: "claude" | "free") => void;
  info: ProviderInfo;
}) {
  const t = useTranslations("ai.provider");
  const [confirming, setConfirming] = useState(false);
  const [, start] = useTransition();

  const choose = (p: "claude" | "free") => {
    onChange(p);
    start(() => setAiProviderAction(p));
  };

  const option = (p: "claude" | "free", available: boolean, icon: React.ReactNode, title: string, sub: string) => (
    <button
      type="button"
      disabled={!available}
      aria-pressed={value === p}
      onClick={() => (p === "free" && value !== "free" ? setConfirming(true) : choose(p))}
      className={`relative flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
        value === p ? "text-accent-ink" : "hover:bg-surface-2/70"
      }`}
    >
      {value === p && <motion.span layoutId="provider-pill" className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent to-[color-mix(in_oklab,var(--accent)_70%,var(--accent-2))]" />}
      <span className="relative">{icon}</span>
      <span className="relative min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className={`block truncate text-[11px] ${value === p ? "opacity-85" : "text-muted"}`}>{sub}</span>
      </span>
    </button>
  );

  const claudeSub = !info.claudeAvailable
    ? t(`unavailable.${info.claudeReason ?? "disabled"}`)
    : info.budgetUsedPct != null
      ? t("budgetUsed", { pct: info.budgetUsedPct })
      : t("claudeSub");

  return (
    <>
      <div className="glass flex gap-1 rounded-3xl p-1">
        {option("claude", info.claudeAvailable, <Sparkles className="size-5" />, t("claude"), claudeSub)}
        {option("free", info.freeAvailable, <Gift className="size-5" />, t("free", { name: info.freeName }), info.freeAvailable ? t("freeSub") : t("unavailable.free"))}
      </div>

      <AnimatePresence>
        {confirming && (
          <motion.div
            className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setConfirming(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="free-ai-title"
              className="glass w-full max-w-lg space-y-4 rounded-3xl p-6"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#f2b705]/20 text-[#f2b705]">
                  <AlertTriangle className="size-6" />
                </span>
                <h2 id="free-ai-title" className="section-title">
                  {t("modal.title", { name: info.freeName })}
                </h2>
              </div>
              <p className="text-sm text-muted">{t("modal.lead")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-line p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                    <Sparkles className="size-4 text-accent" /> {t("claude")}
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {(["c1", "c2", "c3"] as const).map((k) => (
                      <li key={k} className="flex gap-1.5">
                        <Check className="size-3.5 shrink-0 text-success" /> {t(`modal.${k}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-line p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                    <Gift className="size-4 text-accent" /> {t("free", { name: info.freeName })}
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {(["f1", "f2", "f3", "f4"] as const).map((k) => (
                      <li key={k} className="flex gap-1.5">
                        {k === "f1" ? <Check className="size-3.5 shrink-0 text-success" /> : <AlertTriangle className="size-3.5 shrink-0 text-[#f2b705]" />} {t(`modal.${k}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-3 text-xs text-muted">
                <BookOpen className="mt-0.5 size-4 shrink-0" /> {t("modal.tip")}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
                  <ShieldCheck className="size-4" /> {t("modal.stay")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setConfirming(false);
                    choose("free");
                  }}
                >
                  {t("modal.switch")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

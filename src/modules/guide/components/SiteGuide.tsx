"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { finishGuideAction } from "../actions";

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

type Box = { top: number; left: number; width: number; height: number };

function findTarget(name?: string): Box | null {
  if (!name) return null;
  const el = [...document.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`)].find((e) => e.offsetParent !== null || e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function SiteGuide({ autoStart, name, menu, donate }: { autoStart: boolean; name: string; menu: string[]; donate: boolean }) {
  const t = useTranslations("guide");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [vw, setVw] = useState(1200);
  const [vh, setVh] = useState(800);
  const [showNext, setShowNext] = useState(false);
  const [mounted, setMounted] = useState(false);

  const steps = STEPS.filter((s) => (!s.module || menu.includes(s.module)) && (!s.donate || donate));
  const step = steps[index];

  // First sign-in: start once the page (and its transition) has settled.
  useEffect(() => {
    setMounted(true);
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

  // Follow the target (window resize, scroll, menu collapsed…).
  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      setBox(findTarget(step.target));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  const close = useCallback(() => {
    setOpen(false);
    void finishGuideAction(showNext);
  }, [showNext]);
  const next = useCallback(() => (index < steps.length - 1 ? setIndex(index + 1) : close()), [index, steps.length, close]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, prev]);

  if (!mounted || !step) return null;

  // Where the pawn and the bubble go: next to the target, or in the middle of the screen.
  const BUBBLE_W = Math.min(340, vw - 32);
  const PAWN = 52;
  let pawn = { x: vw / 2 - PAWN / 2, y: vh / 2 - 190 };
  let bubble = { x: vw / 2 - BUBBLE_W / 2, y: vh / 2 - 120 };
  if (box) {
    if (box.left + box.width < 320 && box.height < vh * 0.6) {
      // menu entries (left): pawn just right of it, bubble beside the pawn
      pawn = { x: box.left + box.width + 10, y: box.top + box.height / 2 - PAWN / 2 };
      bubble = { x: pawn.x + PAWN + 12, y: Math.max(16, Math.min(vh - 300, box.top - 20)) };
    } else if (box.left + box.width < 320) {
      // the whole menu: bubble beside it, mid-height
      pawn = { x: box.left + box.width + 10, y: vh / 2 - 120 };
      bubble = { x: pawn.x + PAWN + 12, y: vh / 2 - 140 };
    } else {
      // top bar items: pawn below, bubble under it (kept on screen)
      pawn = { x: box.left + box.width / 2 - PAWN / 2, y: box.top + box.height + 10 };
      bubble = { x: Math.max(16, Math.min(vw - BUBBLE_W - 16, box.left + box.width / 2 - BUBBLE_W / 2)), y: pawn.y + PAWN + 10 };
    }
  }
  bubble.x = Math.max(16, Math.min(vw - BUBBLE_W - 16, bubble.x));

  const params = { name };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="guide-title">
          {/* dim everything but the spot being explained */}
          {box ? (
            <motion.div
              className="pointer-events-none absolute rounded-2xl border-2 border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
              animate={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/55" />
          )}

          {/* the pawn travels from one stop to the next */}
          <motion.div className="pointer-events-none absolute" animate={{ left: pawn.x, top: pawn.y }} transition={{ type: "spring", bounce: 0.3, duration: 0.8 }}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="grid place-items-center rounded-full shadow-[0_10px_20px_-6px_rgb(0_0_0/0.6)]"
              style={{
                width: PAWN,
                height: PAWN,
                background: "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent) 60%, white), var(--accent) 55%, color-mix(in oklab, var(--accent) 60%, black))",
              }}
            >
              <Meeple color="#fff" size={26} />
            </motion.div>
          </motion.div>

          {/* the explanation */}
          <motion.div
            key={step.key}
            className="glass absolute space-y-3 rounded-2xl p-4 shadow-2xl"
            style={{ width: BUBBLE_W }}
            initial={{ opacity: 0, scale: 0.95, left: bubble.x, top: bubble.y }}
            animate={{ opacity: 1, scale: 1, left: bubble.x, top: bubble.y }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[11px] font-bold uppercase tracking-widest text-accent">{t("progress", { n: index + 1, total: steps.length })}</p>
              <button type="button" onClick={close} className="-mr-1 -mt-1 rounded-lg p-1 text-muted hover:text-ink" title={t("skip")}>
                <X className="size-4" />
              </button>
            </div>
            <h2 id="guide-title" className="font-display text-lg font-bold leading-tight">
              {t(`steps.${step.key}.title`, params)}
            </h2>
            <ul className="space-y-1.5 text-sm">
              {Array.from({ length: step.bullets }, (_, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{t(`steps.${step.key}.b${i + 1}`, params)}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showNext} onChange={(e) => setShowNext(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />
              {t("showNext")}
            </label>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button type="button" onClick={prev} className="btn btn-ghost btn-sm" title={t("previous")}>
                  <ChevronLeft className="size-4" />
                </button>
              )}
              <div className="flex flex-1 justify-center gap-1" aria-hidden>
                {steps.map((s, i) => (
                  <span key={s.key} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-accent" : "w-1.5 bg-line"}`} />
                ))}
              </div>
              <button type="button" onClick={next} className="btn btn-primary btn-sm" autoFocus>
                {index === steps.length - 1 ? t("finish") : t("next")}
                {index < steps.length - 1 && <ChevronRight className="size-4" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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

"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Meeple } from "@/components/Meeple";

// The guided-tour overlay: a game pawn walks to the spot being explained (a [data-guide]
// element), which stays lit while the rest dims, with a short bullet-point bubble beside it.
// Used by the members' welcome guide and by the public demo tour.

type Box = { top: number; left: number; width: number; height: number };

function findTarget(name?: string): Box | null {
  if (!name) return null;
  const el = [...document.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`)].find((e) => e.offsetParent !== null || e.getClientRects().length);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export type GuideLabels = { progress: string; skip: string; next: string; previous: string; finish: string };

export function GuideOverlay({
  open,
  stepKey,
  index,
  total,
  title,
  bullets,
  target,
  footer,
  labels,
  onNext,
  onPrev,
  onClose,
}: {
  open: boolean;
  stepKey: string;
  index: number;
  total: number;
  title: string;
  bullets: string[];
  /** the [data-guide] element to point at; none = middle of the screen */
  target?: string;
  /** extra content under the bullets (a checkbox, a button…) */
  footer?: ReactNode;
  labels: GuideLabels;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [vw, setVw] = useState(1200);
  const [vh, setVh] = useState(800);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Follow the target (window resize, scroll, a page that is still loading…).
  useLayoutEffect(() => {
    if (!open) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      setBox(findTarget(target));
    };
    // a target inside the page: bring it into view first
    const el = target ? document.querySelector<HTMLElement>(`[data-guide="${target}"]`) : null;
    if (el && el.getBoundingClientRect().left > 300) el.scrollIntoView({ block: "center", behavior: "smooth" });
    // the target may not be there yet (another page is loading): look again for a moment
    const poll = () => {
      measure();
      if (target && !findTarget(target) && tries++ < 20) timer = setTimeout(poll, 100);
    };
    poll();
    const late = setTimeout(measure, 450); // after the smooth scroll
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(late);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, target, stepKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onNext, onPrev]);

  if (!mounted) return null;

  // Where the pawn and the bubble go: next to the target, or in the middle of the screen.
  const BUBBLE_W = Math.min(340, vw - 32);
  const BUBBLE_H = 270; // room kept for the bubble
  const PAWN = 52;
  let pawn = { x: vw / 2 - PAWN / 2, y: vh / 2 - 190 };
  let bubble = { x: vw / 2 - BUBBLE_W / 2, y: vh / 2 - 120 };
  if (box) {
    const bottom = box.top + box.height;
    if (box.left + box.width < 320 && box.height < vh * 0.6) {
      // menu entries (left): pawn just right of it, bubble beside the pawn
      pawn = { x: box.left + box.width + 10, y: box.top + box.height / 2 - PAWN / 2 };
      bubble = { x: pawn.x + PAWN + 12, y: Math.max(16, Math.min(vh - 300, box.top - 20)) };
    } else if (box.left + box.width < 320) {
      // the whole menu: bubble beside it, mid-height
      pawn = { x: box.left + box.width + 10, y: vh / 2 - 120 };
      bubble = { x: pawn.x + PAWN + 12, y: vh / 2 - 140 };
    } else if (vh - bottom > BUBBLE_H + PAWN) {
      // room below: pawn under the target, bubble under the pawn
      pawn = { x: box.left + box.width / 2 - PAWN / 2, y: bottom + 10 };
      bubble = { x: box.left + box.width / 2 - BUBBLE_W / 2, y: pawn.y + PAWN + 10 };
    } else if (box.top > BUBBLE_H + PAWN) {
      // room above
      bubble = { x: box.left + box.width / 2 - BUBBLE_W / 2, y: box.top - PAWN - 20 - BUBBLE_H };
      pawn = { x: box.left + box.width / 2 - PAWN / 2, y: box.top - PAWN - 10 };
    } else {
      // a big block (a form, a list): the bubble sits in the bottom corner, over it
      bubble = { x: vw - BUBBLE_W - 24, y: vh - BUBBLE_H - 24 };
      pawn = { x: bubble.x - PAWN - 8, y: vh - PAWN - 40 };
    }
  }
  bubble.x = Math.max(16, Math.min(vw - BUBBLE_W - 16, bubble.x));
  bubble.y = Math.max(16, Math.min(vh - BUBBLE_H, bubble.y));
  const last = index === total - 1;

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
            key={stepKey}
            className="glass absolute max-h-[calc(100dvh-32px)] space-y-3 overflow-y-auto rounded-2xl p-4 shadow-2xl"
            style={{ width: BUBBLE_W }}
            initial={{ opacity: 0, scale: 0.95, left: bubble.x, top: bubble.y }}
            animate={{ opacity: 1, scale: 1, left: bubble.x, top: bubble.y }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[11px] font-bold uppercase tracking-widest text-accent">{labels.progress}</p>
              <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded-lg p-1 text-muted hover:text-ink" title={labels.skip}>
                <X className="size-4" />
              </button>
            </div>
            <h2 id="guide-title" className="font-display text-lg font-bold leading-tight">
              {title}
            </h2>
            <ul className="space-y-1.5 text-sm">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {footer}
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button type="button" onClick={onPrev} className="btn btn-ghost btn-sm" title={labels.previous}>
                  <ChevronLeft className="size-4" />
                </button>
              )}
              <div className="flex flex-1 flex-wrap justify-center gap-1" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-accent" : "w-1.5 bg-line"}`} />
                ))}
              </div>
              <button type="button" onClick={onNext} className="btn btn-primary btn-sm" autoFocus>
                {last ? labels.finish : labels.next}
                {!last && <ChevronRight className="size-4" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

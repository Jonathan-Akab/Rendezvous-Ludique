"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dices } from "lucide-react";

// Small per-browser memory (filters, the last list, the usual players).
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);
  // accepts a value or an updater, so quick successive clicks never undo each other
  const set = (v: T | ((prev: T) => T)) =>
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [value, set] as const;
}

/** The table where the result lands: a die that tumbles while the names flash by. */
export function Stage({ rolling, idle, children }: { rolling: boolean; idle: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-3xl border border-line/70 bg-bg/50 p-5 text-center">
      <motion.div
        className="pointer-events-none absolute right-4 top-4 text-accent"
        animate={rolling ? { rotate: [0, 90, 180, 270, 360], y: [0, -6, 0, -4, 0] } : { rotate: 0, y: 0 }}
        transition={rolling ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
      >
        <Dices className="size-7" />
      </motion.div>
      {children ?? <p className="max-w-xs text-sm text-muted">{idle}</p>}
    </div>
  );
}

/** Big name flashing during the roll, then the winner (with a little bounce). */
export function Flash({ text, rolling, sub }: { text: string; rolling: boolean; sub?: ReactNode }) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={text + String(rolling)}
          initial={rolling ? { opacity: 0.4, y: 6 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={rolling ? { duration: 0.08 } : { type: "spring", bounce: 0.5, duration: 0.5 }}
          className={`font-display font-black leading-tight ${rolling ? "text-2xl text-muted" : "text-3xl text-accent"}`}
        >
          {text}
        </motion.p>
      </AnimatePresence>
      {!rolling && sub}
    </div>
  );
}

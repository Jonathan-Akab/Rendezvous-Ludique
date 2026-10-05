"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { animationsOn } from "@/components/AnimationToggle";

export const pickOne = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Draw where each item counts for its weight (e.g. less played games come up more often). */
export function pickWeighted<T>(items: T[], weight: (item: T) => number) {
  const weights = items.map((x) => Math.max(0, weight(x)));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Fisher–Yates: a fair shuffle (turn order). */
export function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A draw that "rolls": the candidates flash by, slowing down, then the winner lands.
 * The winner is drawn up front (fair), the flashing is only for show — skipped when the
 * member turned animations off or prefers reduced motion.
 */
export function useRoll<T>() {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<T | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const roll = useCallback(
    (items: T[], onDone?: (winner: T) => void, weight?: (item: T) => number) => {
      if (!items.length) return;
      if (timer.current) clearTimeout(timer.current);
      const winner = weight ? pickWeighted(items, weight) : pickOne(items);
      if (reduce || !animationsOn() || items.length === 1) {
        setShown(winner);
        setResult(winner);
        setRolling(false);
        onDone?.(winner);
        return;
      }
      setRolling(true);
      setResult(null);
      let delay = 45;
      let elapsed = 0;
      let previous: T | null = null;
      const step = () => {
        // never the same one twice in a row, so the flashing is visible
        let next = pickOne(items);
        if (next === previous) next = items[(items.indexOf(next) + 1) % items.length];
        previous = next;
        setShown(next);
        elapsed += delay;
        delay *= 1.16;
        if (elapsed < 1600) timer.current = setTimeout(step, delay);
        else
          timer.current = setTimeout(() => {
            setShown(winner);
            setResult(winner);
            setRolling(false);
            onDone?.(winner);
          }, delay);
      };
      step();
    },
    [reduce],
  );

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShown(null);
    setResult(null);
    setRolling(false);
  }, []);

  return { shown, result, rolling, roll, reset };
}

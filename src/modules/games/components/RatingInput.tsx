"use client";

import { useOptimistic, useState, useTransition } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { MEEPLE_PATH } from "@/components/Meeple";
import { rateGameAction } from "../actions";

/** Rate a game from 1 to 10 meeples. Saves immediately. */
export function RatingInput({ gameId, value, size = 22 }: { gameId: string; value: number | null; size?: number }) {
  const t = useTranslations("games.rating");
  const [hover, setHover] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [, start] = useTransition();
  const shown = hover ?? optimistic ?? 0;

  const rate = (score: number) =>
    start(async () => {
      setOptimistic(score || null);
      await rateGameAction(gameId, score);
    });

  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="radiogroup" aria-label={t("yours")} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={optimistic === n}
            aria-label={`${n}/10`}
            title={`${n}/10`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => rate(n)}
            whileTap={{ scale: 1.4, y: -4 }}
            className="p-0.5"
          >
            <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
              <path
                d={MEEPLE_PATH}
                className="transition-colors"
                fill={n <= shown ? "var(--accent)" : "var(--line)"}
                opacity={n <= shown ? 1 : 0.7}
              />
            </svg>
          </motion.button>
        ))}
      </div>
      <span className="w-10 text-sm font-bold tabular-nums">{shown ? `${shown}/10` : ""}</span>
      {optimistic != null && (
        <button type="button" onClick={() => rate(0)} className="text-muted hover:text-danger" title={t("clear")}>
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

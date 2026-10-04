"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { MEEPLE_COLORS } from "@/lib/constants";

/** Pick your meeple colour; submits as the `meepleColor` form field. */
export function MeepleColorPicker({ defaultValue = "#d9480f", name = "meepleColor" }: { defaultValue?: string; name?: string }) {
  const t = useTranslations("meeple");
  const [color, setColor] = useState(defaultValue);
  const [bump, setBump] = useState(0);

  const choose = (hex: string) => {
    setColor(hex);
    setBump((b) => b + 1);
  };

  return (
    <div className="flex items-center gap-5">
      <motion.div
        key={bump}
        initial={bump ? { y: 0, rotate: 0 } : false}
        animate={{ y: [0, -18, 0], rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="grid size-24 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2"
      >
        <Meeple color={color} size={72} title={t("yours")} />
      </motion.div>
      <div className="flex-1">
        <input type="hidden" name={name} value={color} />
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={t("color")}>
          {MEEPLE_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={color.toLowerCase() === c.hex}
              title={t(`colors.${c.key}`)}
              onClick={() => choose(c.hex)}
              className="grid size-8 place-items-center rounded-full border-2 border-line transition hover:scale-110"
              style={{ background: c.hex }}
            >
              {color.toLowerCase() === c.hex && (
                <Check className="size-4" style={{ color: c.key === "white" || c.key === "yellow" ? "#222" : "#fff" }} />
              )}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          <input
            type="color"
            value={color}
            onChange={(e) => choose(e.target.value)}
            className="size-7 cursor-pointer rounded border border-line bg-transparent"
          />
          {t("custom")}
        </label>
      </div>
    </div>
  );
}

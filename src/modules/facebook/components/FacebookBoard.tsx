"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List, Pin } from "lucide-react";
import { FacebookPageTile } from "./FacebookPageTile";
import { FacebookGroupTile, type FbGroup } from "./FacebookGroupTile";
import { setFacebookPinsAction } from "../actions";

// "Groupes Facebook": the promoted page and the groups as tiles. Each member pins the ones
// they want on top (saved on their profile) and picks tiles or a compact list (this browser).

export type FbItem = { key: string; kind: "page"; url: string; name: string } | { key: string; kind: "group"; group: FbGroup };
type Display = "tiles" | "list";
const DISPLAY_KEY = "rl-fb-display";

export function FacebookBoard({ items, pins: initialPins }: { items: FbItem[]; pins: string[] }) {
  const t = useTranslations("facebook.board");
  const [pins, setPins] = useState(initialPins.filter((k) => items.some((i) => i.key === k)));
  const [display, setDisplay] = useState<Display>("tiles");

  useEffect(() => {
    try {
      if (localStorage.getItem(DISPLAY_KEY) === "list") setDisplay("list");
    } catch {}
  }, []);
  const changeDisplay = (d: Display) => {
    setDisplay(d);
    try {
      localStorage.setItem(DISPLAY_KEY, d);
    } catch {}
  };
  const togglePin = (key: string) => {
    const next = pins.includes(key) ? pins.filter((k) => k !== key) : [...pins, key];
    setPins(next);
    void setFacebookPinsAction(next);
  };

  // pinned first (in the order they were pinned), then the others in the admins' order
  const sorted = [...items.filter((i) => pins.includes(i.key)).sort((a, b) => pins.indexOf(a.key) - pins.indexOf(b.key)), ...items.filter((i) => !pins.includes(i.key))];
  const several = items.length > 1;

  return (
    <div className="space-y-4">
      {several && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-line/70 bg-surface-2/60 p-0.5" role="group" aria-label={t("display")}>
            {(["tiles", "list"] as Display[]).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={display === d}
                onClick={() => changeDisplay(d)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${display === d ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
              >
                {d === "tiles" ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
                {t(d)}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Pin className="size-3.5" /> {t("pinHint")}
          </p>
        </div>
      )}

      <div className={display === "tiles" ? "grid max-w-3xl grid-cols-2 gap-3 sm:gap-5" : "max-w-2xl space-y-2"}>
        {sorted.map((item) => {
          const pinned = pins.includes(item.key);
          const variant = display === "tiles" ? "tile" : "row";
          return (
            <motion.div key={item.key} layout transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} className="relative">
              {item.kind === "page" ? <FacebookPageTile url={item.url} name={item.name} variant={variant} /> : <FacebookGroupTile group={item.group} variant={variant} />}
              {several && (
                <button
                  type="button"
                  onClick={() => togglePin(item.key)}
                  aria-pressed={pinned}
                  title={pinned ? t("unpin") : t("pin")}
                  className={`absolute z-10 grid size-8 place-items-center rounded-full shadow transition ${
                    display === "tiles" ? "right-3 top-3" : "right-3 top-1/2 -translate-y-1/2"
                  } ${pinned ? "bg-[#ffd43b] text-[#7a4d00]" : "bg-black/25 text-white/80 hover:bg-black/40 hover:text-white"}`}
                >
                  <Pin className={`size-4 ${pinned ? "fill-current" : ""}`} />
                  <span className="sr-only">{pinned ? t("unpin") : t("pin")}</span>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

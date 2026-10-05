"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Meeple } from "@/components/Meeple";
import { animationsOn } from "@/components/AnimationToggle";

// Page transitions borrowed from the table: tiles flipping into place, cards being dealt,
// a die rolling. Each is a layer drawn over the
// page that clears away (the page itself is never transformed, so sticky and fixed parts
// keep working). Pointer events pass through.

export type TransitionKind = "tiles" | "cards" | "dice";

const KINDS: TransitionKind[] = ["tiles", "cards", "dice"];
let lastKind: TransitionKind | null = null;

/** A transition picked at random — never the same one twice in a row. */
export function randomTransition(): TransitionKind {
  const choices = KINDS.filter((k) => k !== lastKind);
  lastKind = choices[Math.floor(Math.random() * choices.length)];
  return lastKind;
}

// Covers the visible part of the page (not the whole height of a long page).
const LAYER = "pointer-events-none absolute inset-x-0 top-0 z-20 overflow-hidden rounded-3xl";
const LAYER_HEIGHT = { height: "min(100%, calc(100dvh - 7rem))" };
const ease = [0.65, 0, 0.35, 1] as const;

/** Cardboard look shared by tiles, board and mat backs, in the theme's colours. */
const cardboard: React.CSSProperties = {
  backgroundColor: "color-mix(in oklab, var(--accent) 55%, var(--surface))",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.05) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.06) 0 2px, transparent 2px 9px)",
};

function Tiles() {
  const cols = 8;
  const rows = 5;
  return (
    <div className={LAYER} style={{ ...LAYER_HEIGHT, perspective: 1200 }} aria-hidden>
      <div className="grid h-full w-full gap-1 p-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          return (
            <motion.div
              key={i}
              className="rounded-lg border border-white/15 shadow-md"
              style={{ ...cardboard, filter: `brightness(${0.9 + ((c * 7 + r * 3) % 5) * 0.05})` }}
              initial={{ rotateY: 0, opacity: 1, scale: 1 }}
              animate={{ rotateY: 90, opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.5, delay: (c + r) * 0.055, ease }}
            />
          );
        })}
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="grid h-full w-full place-items-center rounded-2xl border-4 border-white/80 shadow-2xl" style={cardboard}>
      <div className="grid size-[70%] place-items-center rounded-xl border-2 border-white/40">
        <Meeple color="#fff" size={40} />
      </div>
    </div>
  );
}

function Cards() {
  return (
    <div className={LAYER} style={LAYER_HEIGHT} aria-hidden>
      <motion.div className="absolute inset-0 bg-bg" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.6, delay: 0.25 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-[30%] h-44 w-32 -translate-x-1/2"
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: (i - 2) * 220, y: [0, -30, 260], rotate: (i - 2) * 14, opacity: [1, 1, 0] }}
          transition={{ duration: 1.05, delay: i * 0.08, ease }}
        >
          <CardBack />
        </motion.div>
      ))}
    </div>
  );
}

/** Pips of each face, as positions in % of the die. */
const FACES: [number, number][][] = [
  [[50, 50]],
  [[28, 28], [72, 72]],
  [[28, 28], [50, 50], [72, 72]],
  [[28, 28], [72, 28], [28, 72], [72, 72]],
  [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
];

function Die() {
  // the face changes while it tumbles, then settles on one
  const [face, setFace] = useState(() => Math.floor(Math.random() * 6));
  useEffect(() => {
    const roll = setInterval(() => setFace((f) => (f + 1 + Math.floor(Math.random() * 5)) % 6), 150);
    const stop = setTimeout(() => clearInterval(roll), 1500);
    return () => {
      clearInterval(roll);
      clearTimeout(stop);
    };
  }, []);
  return (
    <div className={LAYER} style={LAYER_HEIGHT} aria-hidden>
      <motion.div className="absolute inset-0 bg-bg" initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.7, delay: 0.3 }} />
      <motion.div
        className="absolute top-[30%] size-20 rounded-[1.4rem] border border-black/10 bg-white shadow-[0_18px_30px_-10px_rgb(0_0_0/0.55)]"
        initial={{ left: "-12%", rotate: -30, y: -40, opacity: 1 }}
        animate={{ left: ["-12%", "30%", "52%", "62%", "64%"], rotate: [-30, 260, 470, 530, 540], y: [-40, 0, -45, 0, -14, 0], opacity: [1, 1, 1, 1, 0] }}
        transition={{ duration: 2.5, times: [0, 0.3, 0.55, 0.75, 1], ease: "easeOut", opacity: { duration: 2.5, times: [0, 0.6, 0.75, 0.85, 1] } }}
      >
        {FACES[face].map(([x, y], i) => (
          <span key={i} className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </motion.div>
    </div>
  );
}

const LAYERS: Record<TransitionKind, () => React.ReactElement> = { tiles: Tiles, cards: Cards, dice: Die };

/** The page, with the module's board-game transition drawn over it when `play` is set. */
export function BoardGameTransition({ play, children }: { play: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  // Picked in the browser after the first render (random on the server would differ).
  const [kind, setKind] = useState<TransitionKind | null>(null);
  const drawn = useRef(false); // one draw per page, even when React runs effects twice in dev
  useEffect(() => {
    if (!play || drawn.current || !animationsOn()) return;
    drawn.current = true;
    setKind(randomTransition());
  }, [play]);
  const Layer = kind ? LAYERS[kind] : null;
  return (
    <div className="relative">
      {play && !reduce && Layer && (
        <div data-transition={kind} className="contents">
          <Layer />
        </div>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: Layer && !reduce ? 0.45 : 0.25, delay: Layer && !reduce ? 0.15 : 0 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

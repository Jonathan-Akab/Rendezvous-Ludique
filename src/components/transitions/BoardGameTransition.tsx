"use client";

import { motion, useReducedMotion } from "motion/react";
import { Meeple } from "@/components/Meeple";

// Page transitions borrowed from the table: tiles flipping into place, a board unfolding,
// a player mat unrolling, cards being dealt, a die rolling. Each is a layer drawn over the
// page that clears away (the page itself is never transformed, so sticky and fixed parts
// keep working). Pointer events pass through.

export type TransitionKind = "tiles" | "board" | "mat" | "cards" | "dice";

/** Which transition a module gets (by the first segment of its path). */
export function transitionFor(pathname: string): TransitionKind {
  const seg = pathname.split("/")[1] ?? "";
  if (["kallax", "games"].includes(seg)) return "board";
  if (["plays", "friends", "members", "settings"].includes(seg)) return "mat";
  if (["ai", "rulebooks", "suggestions"].includes(seg)) return "cards";
  if (["bazaar", "facebook"].includes(seg)) return "dice";
  return "tiles"; // home, events…
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
              transition={{ duration: 0.38, delay: (c + r) * 0.04, ease }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Board() {
  const half = (side: "left" | "right") => (
    <motion.div
      className="absolute inset-y-0 w-1/2 border border-white/15 shadow-2xl"
      style={{
        ...cardboard,
        [side]: 0,
        transformOrigin: side,
        borderRadius: side === "left" ? "1.5rem 0 0 1.5rem" : "0 1.5rem 1.5rem 0",
      }}
      initial={{ rotateY: 0 }}
      animate={{ rotateY: side === "left" ? -100 : 100, opacity: 0 }}
      transition={{ duration: 0.75, ease, opacity: { duration: 0.2, delay: 0.55 } }}
    >
      {/* the board's inner frame and title, like the back of a game board */}
      <div className="absolute inset-3 rounded-2xl border-2 border-white/20" />
    </motion.div>
  );
  return (
    <div className={LAYER} style={{ ...LAYER_HEIGHT, perspective: 1800 }} aria-hidden>
      {half("left")}
      {half("right")}
      <motion.div
        className="absolute inset-y-0 left-1/2 w-px bg-black/30"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}

function Mat() {
  return (
    <div className={LAYER} style={LAYER_HEIGHT} aria-hidden>
      {/* the mat rolls down: what's above the roll is unrolled */}
      <motion.div
        className="absolute inset-0 border border-white/15"
        style={{ ...cardboard, transformOrigin: "bottom" }}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.7, ease }}
      />
      <motion.div
        className="absolute inset-x-2 h-7 rounded-full shadow-[0_10px_20px_-6px_rgb(0_0_0/0.5)]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--accent) 40%, black) 0%, color-mix(in oklab, var(--accent) 70%, white) 45%, color-mix(in oklab, var(--accent) 45%, black) 100%)",
        }}
        initial={{ top: "0%", opacity: 1 }}
        animate={{ top: "100%", opacity: 0 }}
        transition={{ duration: 0.7, ease, opacity: { duration: 0.15, delay: 0.6 } }}
      />
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
      <motion.div className="absolute inset-0 bg-bg" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.15 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-[30%] h-44 w-32 -translate-x-1/2"
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: (i - 2) * 220, y: [0, -30, 260], rotate: (i - 2) * 14, opacity: [1, 1, 0] }}
          transition={{ duration: 0.75, delay: i * 0.05, ease }}
        >
          <CardBack />
        </motion.div>
      ))}
    </div>
  );
}

function Die() {
  const pips = [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ];
  return (
    <div className={LAYER} style={LAYER_HEIGHT} aria-hidden>
      <motion.div className="absolute inset-0 bg-bg" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.2 }} />
      <motion.div
        className="absolute top-[28%] size-16 rounded-2xl border border-black/10 bg-white shadow-xl"
        initial={{ left: "-10%", rotate: 0, y: 0 }}
        animate={{ left: "105%", rotate: 540, y: [0, -60, 0, -25, 0, -8, 0] }}
        transition={{ duration: 0.85, ease: "easeOut" }}
      >
        {pips.map(([x, y], i) => (
          <span key={i} className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </motion.div>
    </div>
  );
}

const LAYERS: Record<TransitionKind, () => React.ReactElement> = { tiles: Tiles, board: Board, mat: Mat, cards: Cards, dice: Die };

/** The page, with the module's board-game transition drawn over it when `play` is set. */
export function BoardGameTransition({ kind, play, children }: { kind: TransitionKind; play: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const Layer = LAYERS[kind];
  return (
    <div className="relative">
      {play && !reduce && <Layer />}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: play && !reduce ? 0.35 : 0.25, delay: play && !reduce ? 0.1 : 0 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

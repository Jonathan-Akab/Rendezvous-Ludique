"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Meeple } from "./Meeple";
import { GameCover } from "@/modules/games/components/GameCover";

// Animated "game table" behind the login page: hex tiles drifting, meeples hopping,
// a die tumbling. Meeples hop when clicked.

const MEEPLES = [
  { color: "#c92a2a", x: "3%", y: "86%", size: 64, delay: 0 },
  { color: "#1c5fbf", x: "78%", y: "12%", size: 52, delay: 0.6 },
  { color: "#f2b705", x: "84%", y: "62%", size: 72, delay: 1.1 },
  { color: "#2b8a3e", x: "14%", y: "70%", size: 56, delay: 0.3 },
  { color: "#6741d9", x: "48%", y: "84%", size: 44, delay: 1.6 },
  { color: "#212529", x: "60%", y: "28%", size: 36, delay: 0.9 },
];

const HEXES = [
  { x: "4%", y: "40%", color: "#2f6b2f", size: 110, rotate: 8 },
  { x: "70%", y: "78%", color: "#c1440e", size: 140, rotate: -12 },
  { x: "88%", y: "30%", color: "#e0b04a", size: 90, rotate: 20 },
  { x: "30%", y: "6%", color: "#868e96", size: 80, rotate: -6 },
  { x: "36%", y: "60%", color: "#8fb3a3", size: 70, rotate: 14 },
];

function Hex({ color, size }: { color: string; size: number }) {
  return (
    <svg viewBox="0 0 100 115" width={size} height={size * 1.15} aria-hidden>
      <path
        d="M50 2 98 29.5v56L50 113 2 85.5v-56z"
        fill={color}
        fillOpacity="0.16"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="2"
      />
    </svg>
  );
}

function Die() {
  return (
    <svg viewBox="0 0 60 60" width={54} height={54} className="wood" aria-hidden>
      <rect x="3" y="3" width="54" height="54" rx="12" fill="#fffaf0" stroke="rgb(0 0 0 / .25)" strokeWidth="2" />
      {[
        [18, 18],
        [42, 18],
        [30, 30],
        [18, 42],
        [42, 42],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="#2b2118" />
      ))}
    </svg>
  );
}

function HoppingMeeple({ m }: { m: (typeof MEEPLES)[number] }) {
  const reduce = useReducedMotion();
  const [hops, setHops] = useState(0);
  return (
    <motion.button
      type="button"
      aria-hidden
      tabIndex={-1}
      className="pointer-events-auto absolute cursor-pointer"
      style={{ left: m.x, top: m.y }}
      initial={{ opacity: 0, y: 30, scale: 0.6 }}
      animate={
        reduce
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, scale: 1, y: [0, -14, 0], rotate: [0, -4, 4, 0] }
      }
      transition={
        reduce
          ? { duration: 0.3 }
          : {
              opacity: { duration: 0.6, delay: m.delay },
              scale: { duration: 0.6, delay: m.delay, type: "spring" },
              y: { duration: 2.6 + m.delay, repeat: Infinity, ease: "easeInOut", delay: m.delay },
              rotate: { duration: 4 + m.delay, repeat: Infinity, ease: "easeInOut" },
            }
      }
      onClick={() => setHops((h) => h + 1)}
    >
      <motion.span
        key={hops}
        className="block"
        animate={hops ? { y: [0, -60, 0], rotate: [0, 360] } : undefined}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <Meeple color={m.color} size={m.size} />
      </motion.span>
    </motion.button>
  );
}

// Made-up game boxes (no real games' artwork) drawn by GameCover.
const BOXES = [
  { name: "Meeple Quest", x: "62%", y: "70%", rotate: -14, delay: 0.5 },
  { name: "Le Grand Kallax", x: "72%", y: "4%", rotate: 10, delay: 0.8 },
  { name: "Dés & Destins", x: "6%", y: "50%", rotate: -8, delay: 1.1 },
];

function Cards() {
  return (
    <svg viewBox="0 0 120 90" width={130} height={98} aria-hidden>
      {[-18, -6, 6, 18].map((r, i) => (
        <g key={r} transform={`rotate(${r} 60 85)`}>
          <rect x="42" y="8" width="36" height="54" rx="5" fill={["#fffaf0", "#f4e3c1", "#e7efe9", "#dfe8f5"][i]} stroke="rgb(0 0 0 / .25)" />
          <circle cx="60" cy="30" r="8" fill={["#c92a2a", "#2b8a3e", "#1c5fbf", "#f2b705"][i]} opacity=".85" />
          <rect x="48" y="44" width="24" height="3" rx="1.5" fill="rgb(0 0 0 / .25)" />
          <rect x="48" y="50" width="16" height="3" rx="1.5" fill="rgb(0 0 0 / .18)" />
        </g>
      ))}
    </svg>
  );
}

export function TableScene() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {BOXES.map((b) => (
        <motion.div
          key={b.name}
          className="absolute hidden w-24 md:block lg:w-28"
          style={{ left: b.x, top: b.y }}
          initial={{ opacity: 0, y: 40, rotate: b.rotate - 20 }}
          animate={reduce ? { opacity: 0.9, y: 0, rotate: b.rotate } : { opacity: 0.9, y: [0, -8, 0], rotate: b.rotate }}
          transition={{ opacity: { delay: b.delay, duration: 0.8 }, rotate: { delay: b.delay, duration: 1, type: "spring" }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: b.delay } }}
        >
          <GameCover name={b.name} size="fill" className="shadow-[0_25px_50px_-15px_rgb(0_0_0/0.6)]" />
        </motion.div>
      ))}
      <motion.div
        className="absolute hidden md:block"
        style={{ left: "40%", top: "80%" }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 0.9, y: 0 }}
        transition={{ delay: 1.3, duration: 0.8 }}
      >
        <Cards />
      </motion.div>
      {HEXES.map((h, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: h.x, top: h.y }}
          initial={{ opacity: 0, rotate: h.rotate - 20 }}
          animate={reduce ? { opacity: 1, rotate: h.rotate } : { opacity: 1, rotate: [h.rotate, h.rotate + 6, h.rotate] }}
          transition={{ duration: 12 + i * 2, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
        >
          <Hex color={h.color} size={h.size} />
        </motion.div>
      ))}
      {MEEPLES.map((m) => (
        <HoppingMeeple key={m.color} m={m} />
      ))}
      <motion.div
        className="absolute"
        style={{ left: "47%", top: "8%" }}
        initial={{ opacity: 0, x: -120, rotate: -200 }}
        animate={{ opacity: 1, x: 0, rotate: 12 }}
        transition={{ duration: 1.4, type: "spring", bounce: 0.35, delay: 0.4 }}
      >
        <Die />
      </motion.div>
    </div>
  );
}

// A game box. Uses the uploaded/linked cover when there is one, otherwise draws an
// original box design from the game's name, so every game has a recognisable visual.

const PALETTES = [
  ["#c1440e", "#f2b705", "#3b2412"],
  ["#1d4e89", "#e8a33d", "#0f2747"],
  ["#2f6b2f", "#d9c27a", "#16331a"],
  ["#6741d9", "#f783ac", "#1f1147"],
  ["#0c8599", "#ffd43b", "#06343b"],
  ["#a33b2c", "#e9d8a6", "#3a1410"],
  ["#3fd0c9", "#f2a93b", "#0b131b"],
  ["#d6336c", "#ffe066", "#3c0d1f"],
  ["#495057", "#ff922b", "#151719"],
  ["#7a4b23", "#e0b04a", "#13212b"],
];

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function BoxArt({ name }: { name: string }) {
  const h = hash(name);
  const [a, b, dark] = PALETTES[h % PALETTES.length];
  const motif = (h >> 4) % 4;
  const words = name.split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 12) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const shown = lines.slice(0, 3);
  const fontSize = shown.some((l) => l.length > 9) ? 13 : 16;
  const id = `g${h.toString(36)}`;

  return (
    <svg viewBox="0 0 120 150" className="h-full w-full" role="img" aria-label={name}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.7" cy="0.25" r="0.6">
          <stop offset="0" stopColor={b} stopOpacity="0.7" />
          <stop offset="1" stopColor={b} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="150" fill={`url(#${id}-bg)`} />
      <rect width="120" height="150" fill={`url(#${id}-glow)`} />
      {motif === 0 &&
        [0, 1, 2, 3].map((r) =>
          [0, 1, 2].map((c) => (
            <path
              key={`${r}-${c}`}
              d="M14 0l12 7v14l-12 7-12-7V7z"
              transform={`translate(${c * 28 + (r % 2) * 14 + 6} ${r * 21 + 62})`}
              fill="none"
              stroke={b}
              strokeOpacity="0.35"
            />
          )),
        )}
      {motif === 1 && [0, 1, 2, 3, 4].map((i) => <circle key={i} cx={95 - i * 14} cy={120 - i * 6} r={18 - i * 2} fill={b} fillOpacity={0.12 + i * 0.05} />)}
      {motif === 2 &&
        [0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={10 + (i % 3) * 34} y={70 + Math.floor(i / 3) * 34} width="28" height="28" rx="4" fill={b} fillOpacity={0.15 + (i % 3) * 0.1} />)}
      {motif === 3 && [0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${92 + i * 14} Q 30 ${80 + i * 14} 60 ${92 + i * 14} T 120 ${92 + i * 14}`} fill="none" stroke={b} strokeOpacity="0.4" strokeWidth="3" />)}
      <path
        d="M60 104c-3 0-5.6 2.4-5.6 5.4 0 1.8.9 3.4 2.3 4.4-3.7.7-9.7 2-11 4.7-.8 1.6.5 3.1 2.4 3.1 1.7 0 4.2-.6 5.8-1-1.4 3.1-4.2 8.1-4.9 11.1-.3 1.3.6 2.5 2 2.5h5.1c.9 0 1.7-.5 2.1-1.4l1.8-4.5 1.8 4.5c.4.9 1.2 1.4 2.1 1.4h5.1c1.3 0 2.3-1.2 2-2.5-.7-3-3.5-8-4.9-11.1 1.7.4 4.1 1 5.8 1 2 0 3.2-1.5 2.4-3.1-1.3-2.7-7.3-4-11-4.7 1.4-1 2.3-2.6 2.3-4.4 0-3-2.5-5.4-5.6-5.4z"
        fill={b}
        opacity="0.95"
      />
      <g fontFamily="var(--font-display), Georgia, serif" fontWeight="800" fill="#fff" textAnchor="middle">
        {shown.map((l, i) => (
          <text key={i} x="60" y={26 + i * (fontSize + 2)} fontSize={fontSize} style={{ paintOrder: "stroke" }} stroke={dark} strokeWidth="3" strokeOpacity="0.35">
            {l}
          </text>
        ))}
      </g>
    </svg>
  );
}

const SIZES = { xs: "w-10", sm: "w-16", md: "w-28", lg: "w-44", xl: "w-60", fill: "w-full" } as const;

export function GameCover({
  name,
  src,
  size = "md",
  className = "",
  tilt = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  tilt?: boolean;
}) {
  return (
    <div
      className={`relative aspect-[4/5] shrink-0 overflow-hidden rounded-lg bg-surface-2 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6),inset_0_0_0_1px_rgb(255_255_255/0.08)] ${SIZES[size]} ${
        tilt ? "transition duration-300 [transform:perspective(600px)_rotateY(-8deg)] group-hover:[transform:perspective(600px)_rotateY(0deg)_translateY(-4px)]" : ""
      } ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <BoxArt name={name} />
      )}
      {/* box edge highlight */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/25 to-transparent" />
    </div>
  );
}

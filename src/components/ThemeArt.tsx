import { MEEPLE_PATH } from "./Meeple";

// Original illustrations evoking each theme's game (no official artwork is used).
// Pure SVG, so they work in server and client components and scale to any size.

const HEX = "M0,-22 L19.05,-11 L19.05,11 L0,22 L-19.05,11 L-19.05,-11Z";

function M({ x, y, s = 1, c }: { x: number; y: number; s?: number; c: string }) {
  return <path d={MEEPLE_PATH} fill={c} stroke="rgb(0 0 0/.3)" strokeWidth="3" transform={`translate(${x} ${y}) scale(${s * 0.2})`} />;
}

function Catan() {
  const tiles: [number, number, string, number | null][] = [
    [0, 0, "#e6d3a3", null],
    [38.1, 0, "#2f6b2f", 6],
    [-38.1, 0, "#e8c547", 8],
    [19.05, -33, "#b5532a", 5],
    [-19.05, -33, "#8fc45a", 9],
    [19.05, 33, "#8a8f98", 4],
    [-19.05, 33, "#2f6b2f", 10],
    [76.2, 0, "#e8c547", 11],
    [-76.2, 0, "#b5532a", 3],
    [57.15, -33, "#8fc45a", 6],
    [-57.15, 33, "#8a8f98", 8],
    [57.15, 33, "#2f6b2f", 2],
    [-57.15, -33, "#e8c547", 12],
  ];
  return (
    <>
      <defs>
        <radialGradient id="ct-sea" cx=".5" cy=".5" r=".75">
          <stop offset="0" stopColor="#4f9bd9" />
          <stop offset="1" stopColor="#1f5c99" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ct-sea)" />
      {[20, 60, 100, 140].map((y) => (
        <path key={y} d={`M0 ${y} q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`} fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="2" />
      ))}
      <g transform="translate(160 92)">
        <path d="M-110 0 L-80 -62 L80 -62 L110 0 L80 62 L-80 62Z" fill="#e3c992" opacity=".9" />
        {tiles.map(([x, y, c, n], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d={HEX} fill={c} stroke="#f4e3c1" strokeWidth="2.5" />
            {n && (
              <>
                <circle r="8" fill="#f8efd8" stroke="#7a5a3a" strokeWidth="1" />
                <text y="3.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={n === 6 || n === 8 ? "#c1440e" : "#3b2412"}>
                  {n}
                </text>
              </>
            )}
          </g>
        ))}
        <path d="M19.05 -11 L19.05 11" stroke="#c92a2a" strokeWidth="5" strokeLinecap="round" />
        <path d="M-25 -22 l7 -7 l7 7 v8 h-14z" fill="#1c5fbf" stroke="#0b2c5a" strokeWidth="1.5" />
        <path d="M14 18 l6 -6 l6 6 v7 h-12z" fill="#c92a2a" stroke="#5c1010" strokeWidth="1.5" />
      </g>
    </>
  );
}

function Anachrony() {
  return (
    <>
      <defs>
        <linearGradient id="an-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060b11" />
          <stop offset="1" stopColor="#14283a" />
        </linearGradient>
        <radialGradient id="an-rift" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#e6fffd" />
          <stop offset=".35" stopColor="#3fd0c9" />
          <stop offset="1" stopColor="#3fd0c9" stopOpacity="0" />
        </radialGradient>
        <filter id="an-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="320" height="180" fill="url(#an-bg)" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={(i * 97) % 320} cy={(i * 53) % 110} r={i % 3 === 0 ? 1.2 : 0.6} fill="#bfe9ff" opacity=".6" />
      ))}
      {/* perspective grid */}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`v${i}`} x1={160} y1={118} x2={-80 + i * 60} y2={180} stroke="#3fd0c9" strokeOpacity=".25" />
      ))}
      {[124, 132, 144, 160, 180].map((y) => (
        <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#3fd0c9" strokeOpacity=".2" />
      ))}
      {/* time rift */}
      <circle cx="210" cy="70" r="58" fill="url(#an-rift)" opacity=".55" filter="url(#an-blur)" />
      {[46, 36, 26].map((r, i) => (
        <circle key={r} cx="210" cy="70" r={r} fill="none" stroke="#3fd0c9" strokeWidth={2 - i * 0.4} strokeDasharray={`${8 + i * 4} ${5 + i * 3}`} opacity=".85" />
      ))}
      {/* exosuit */}
      <g transform="translate(92 62)" fill="#22394d" stroke="#3fd0c9" strokeWidth="1.5">
        <rect x="-16" y="-30" width="32" height="20" rx="6" />
        <rect x="-9" y="-25" width="18" height="6" rx="3" fill="#f2a93b" stroke="none" />
        <path d="M-24 -8 h48 l-6 38 h-36z" />
        <rect x="-38" y="-6" width="12" height="34" rx="5" />
        <rect x="26" y="-6" width="12" height="34" rx="5" />
        <rect x="-18" y="32" width="13" height="30" rx="4" />
        <rect x="5" y="32" width="13" height="30" rx="4" />
        <circle cx="0" cy="8" r="6" fill="#3fd0c9" stroke="none" opacity=".9" />
      </g>
    </>
  );
}

function MerchantsCove() {
  return (
    <>
      <defs>
        <linearGradient id="mc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1622" />
          <stop offset="1" stopColor="#24435a" />
        </linearGradient>
        <radialGradient id="mc-moon" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset=".6" stopColor="#e0b04a" stopOpacity=".5" />
          <stop offset="1" stopColor="#e0b04a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="url(#mc-sky)" />
      <circle cx="250" cy="42" r="40" fill="url(#mc-moon)" />
      <circle cx="250" cy="42" r="16" fill="#fdf1c7" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(i * 71) % 320} cy={(i * 37) % 80} r=".8" fill="#fff" opacity=".7" />
      ))}
      {/* ship */}
      <g transform="translate(120 70)">
        <path d="M-60 52 h120 l-16 24 h-88z" fill="#7a4b23" stroke="#3d240f" strokeWidth="2" />
        <rect x="-62" y="46" width="124" height="8" fill="#5a3518" />
        <line x1="-12" y1="-40" x2="-12" y2="48" stroke="#3d240f" strokeWidth="3" />
        <line x1="26" y1="-20" x2="26" y2="48" stroke="#3d240f" strokeWidth="3" />
        <path d="M-12 -34 q 30 18 0 40 z" fill="#efe1c2" />
        <path d="M-14 -30 q -34 20 0 44 z" fill="#e6d3ad" />
        <path d="M26 -14 q 24 16 0 36 z" fill="#efe1c2" />
        <path d="M-12 -40 l14 4 -14 4z" fill="#c0532d" />
        {[-40, -20, 0, 20, 40].map((x) => (
          <circle key={x} cx={x} cy="60" r="2.4" fill="#ffd36b" />
        ))}
      </g>
      {/* lanterns on the dock */}
      <rect x="230" y="118" width="90" height="10" fill="#5a3518" />
      {[240, 270, 300].map((x) => (
        <g key={x}>
          <line x1={x} y1="100" x2={x} y2="118" stroke="#3d240f" strokeWidth="2" />
          <circle cx={x} cy="98" r="4" fill="#ffd36b" />
          <circle cx={x} cy="98" r="10" fill="#ffd36b" opacity=".2" />
        </g>
      ))}
      {[136, 148, 160, 172].map((y, i) => (
        <path key={y} d={`M0 ${y} q 20 -6 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 V180 H0Z`} fill="#1a3a52" opacity={0.55 + i * 0.12} />
      ))}
    </>
  );
}

function Wingspan() {
  const bird = (x: number, y: number, body: string, wing: string, flip = false) => (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-14 6 l-12 8 l10 -2z" fill={wing} />
      <ellipse cx="0" cy="0" rx="16" ry="11" fill={body} />
      <path d="M-6 -2 q 8 12 18 4 q -6 -10 -18 -4z" fill={wing} />
      <circle cx="13" cy="-8" r="7" fill={body} />
      <circle cx="15" cy="-9" r="1.4" fill="#222" />
      <path d="M19 -8 l7 2 l-7 2z" fill="#e8a33d" />
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeee6" />
          <stop offset="1" stopColor="#f3efe2" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ws-sky)" />
      <circle cx="270" cy="40" r="26" fill="#f6d6b8" opacity=".7" />
      <path d="M-10 132 C 80 118, 160 112, 330 92" stroke="#8a5a2b" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M200 104 q 20 -26 50 -30" stroke="#8a5a2b" strokeWidth="5" fill="none" strokeLinecap="round" />
      {[[60, 124], [130, 114], [240, 80], [290, 92], [180, 108]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y - 8} rx="10" ry="5" fill="#8fb3a3" transform={`rotate(${-30 + i * 15} ${x} ${y - 8})`} />
      ))}
      {bird(90, 104, "#4f7fbf", "#2f5a95")}
      {bird(170, 94, "#c92a2a", "#8a1c1c", true)}
      {bird(250, 62, "#f2c14e", "#c78f1f")}
      {/* nest with eggs */}
      <path d="M30 150 q 30 18 60 0 q -30 -6 -60 0z" fill="#a0784a" />
      {[[48, 146, "#cfe3ef"], [60, 144, "#f4e1d2"], [72, 146, "#e9f2df"]].map(([x, y, c]) => (
        <ellipse key={String(x)} cx={x as number} cy={y as number} rx="6" ry="8" fill={c as string} stroke="#b9a58a" />
      ))}
    </>
  );
}

function Azul() {
  const colors = ["#1d4e89", "#e8a33d", "#c0392b", "#1c1c1c", "#5dc1d9"];
  return (
    <>
      <rect width="320" height="180" fill="#eef3fa" />
      <g transform="translate(24 18)">
        <rect x="-8" y="-8" width="160" height="160" rx="10" fill="#f8e7c4" stroke="#c9a46a" strokeWidth="3" />
        {Array.from({ length: 25 }, (_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const color = colors[(c - r + 5) % 5];
          const filled = (i * 7) % 3 !== 0;
          return (
            <g key={i} transform={`translate(${c * 29 + 2} ${r * 29 + 2})`}>
              <rect width="26" height="26" rx="4" fill={filled ? color : "#fff"} fillOpacity={filled ? 1 : 0.6} stroke={color} strokeOpacity=".5" />
              {filled && <path d="M13 4 L22 13 L13 22 L4 13Z" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />}
              {filled && <circle cx="13" cy="13" r="3" fill="#fff" fillOpacity=".5" />}
            </g>
          );
        })}
      </g>
      {[[230, 50], [280, 100], [220, 130]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="30" fill="#fff" stroke="#c8d6ea" strokeWidth="3" />
          {[[-10, -10], [8, -12], [-8, 8], [10, 8]].map(([dx, dy], j) => (
            <rect key={j} x={dx - 7} y={dy - 7} width="14" height="14" rx="2.5" fill={colors[(i + j) % 5]} transform={`rotate(${j * 12} ${dx} ${dy})`} />
          ))}
        </g>
      ))}
    </>
  );
}

function Terraforming() {
  return (
    <>
      <defs>
        <radialGradient id="tm-planet" cx=".38" cy=".35" r=".7">
          <stop offset="0" stopColor="#f59a5a" />
          <stop offset=".6" stopColor="#b7471f" />
          <stop offset="1" stopColor="#4d1a0c" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill="#0d0605" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 83) % 320} cy={(i * 47) % 180} r={i % 4 === 0 ? 1.1 : 0.5} fill="#fff" opacity=".7" />
      ))}
      <ellipse cx="190" cy="98" rx="120" ry="20" fill="none" stroke="#f2742b" strokeOpacity=".35" strokeWidth="1.5" transform="rotate(-12 190 98)" />
      <circle cx="190" cy="98" r="72" fill="url(#tm-planet)" />
      <g transform="translate(190 98)" opacity=".95">
        {[[-30, -20, "#2e78b5"], [-12, -30, "#2e78b5"], [10, 18, "#3d8b3d"], [28, 6, "#3d8b3d"], [-6, 30, "#8a8f98"], [36, -26, "#3d8b3d"]].map(([x, y, c], i) => (
          <path key={i} d="M0,-11 L9.5,-5.5 L9.5,5.5 L0,11 L-9.5,5.5 L-9.5,-5.5Z" fill={c as string} transform={`translate(${x} ${y})`} stroke="#000" strokeOpacity=".25" />
        ))}
        {[[-40, 20, 7], [20, -40, 5], [44, 30, 6]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#6b2510" opacity=".6" />
        ))}
      </g>
      <g transform="translate(62 54) rotate(30)">
        <path d="M0 -18 q 7 8 7 22 h-14 q 0 -14 7 -22z" fill="#e9ecef" />
        <path d="M-7 4 l-6 8 h6z M7 4 l6 8 h-6z" fill="#c92a2a" />
        <path d="M-4 6 q 4 16 8 0z" fill="#f2742b" />
        <circle cy="-4" r="3" fill="#6cc3d5" />
      </g>
    </>
  );
}

function Carcassonne() {
  const tile = (x: number, y: number, kind: number) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <rect width="50" height="50" fill="#7fa548" stroke="#5c7f2a" />
      {kind === 0 && <path d="M0 25 H50" stroke="#e8dcb5" strokeWidth="7" />}
      {kind === 1 && <path d="M25 0 V50" stroke="#e8dcb5" strokeWidth="7" />}
      {kind === 2 && (
        <>
          <path d="M0 0 H50 Q 25 30 0 0z" fill="#c7a36b" stroke="#8a5a2b" />
          <path d="M8 6 l6 -6 6 6z M30 6 l6 -6 6 6z" fill="#a33b2c" />
        </>
      )}
      {kind === 3 && <path d="M0 25 H25 V50" stroke="#e8dcb5" strokeWidth="7" fill="none" />}
      {kind === 4 && (
        <>
          <rect x="17" y="18" width="16" height="14" fill="#d8c3a0" stroke="#8a5a2b" />
          <path d="M15 18 l10 -9 10 9z" fill="#a33b2c" />
        </>
      )}
    </g>
  );
  const layout = [
    [0, 2, 0, 3, 1],
    [4, 0, 2, 1, 0],
    [1, 3, 0, 4, 2],
  ];
  return (
    <>
      <rect width="320" height="180" fill="#dfe6c3" />
      <g transform="translate(35 15)">
        {layout.flatMap((row, r) => row.map((k, c) => tile(c * 50, r * 50, k)))}
      </g>
      <M x={95} y={52} c="#c92a2a" s={0.9} />
      <M x={195} y={98} c="#1c5fbf" s={0.9} />
      <M x={240} y={20} c="#f2b705" s={0.9} />
    </>
  );
}

function Table({ dark }: { dark: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`tb-${dark}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dark ? "#3b2a1c" : "#c99a63"} />
          <stop offset="1" stopColor={dark ? "#1d140d" : "#9b6b3c"} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#tb-${dark})`} />
      {[30, 70, 110, 150].map((y) => (
        <path key={y} d={`M0 ${y} q 160 ${y % 3 ? 8 : -6} 320 0`} stroke="#000" strokeOpacity=".08" fill="none" />
      ))}
      <rect x="40" y="40" width="130" height="90" rx="8" fill={dark ? "#2c261f" : "#fffaf0"} transform="rotate(-6 105 85)" />
      <rect x="60" y="60" width="40" height="56" rx="4" fill="#d9480f" transform="rotate(-14 80 88)" />
      <rect x="92" y="56" width="40" height="56" rx="4" fill="#1c5fbf" transform="rotate(4 112 84)" />
      <g transform="translate(220 60) rotate(14)">
        <rect width="34" height="34" rx="7" fill="#fffaf0" stroke="#0003" />
        {[[9, 9], [25, 25], [17, 17]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill="#2b2118" />
        ))}
      </g>
      <M x={200} y={110} c="#2b8a3e" />
      <M x={240} y={118} c="#f2b705" />
      <M x={268} y={100} c="#6741d9" />
    </>
  );
}

export function ThemeArt({ theme, className = "" }: { theme: string; className?: string }) {
  let scene: React.ReactNode;
  switch (theme) {
    case "catan":
      scene = <Catan />;
      break;
    case "anachrony":
      scene = <Anachrony />;
      break;
    case "merchants-cove":
      scene = <MerchantsCove />;
      break;
    case "wingspan":
      scene = <Wingspan />;
      break;
    case "azul":
      scene = <Azul />;
      break;
    case "terraforming":
      scene = <Terraforming />;
      break;
    case "carcassonne":
      scene = <Carcassonne />;
      break;
    default:
      scene = <Table dark={theme === "dark"} />;
  }
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      {scene}
    </svg>
  );
}

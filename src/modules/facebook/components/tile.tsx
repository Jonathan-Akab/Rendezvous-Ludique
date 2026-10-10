/** Board-tile look shared by the Facebook tiles: thick frame, dotted pattern, square. */
export const FB_TILE =
  "group relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-[6px] p-3 text-center text-white transition hover:-translate-y-0.5 hover:rotate-[-0.8deg] sm:gap-3 sm:p-5";

export function TilePattern() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-20"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgb(255 255 255 / 0.5) 0 2px, transparent 3px), radial-gradient(circle at 70% 70%, rgb(255 255 255 / 0.4) 0 2px, transparent 3px)",
        backgroundSize: "28px 28px, 34px 34px",
      }}
    />
  );
}

/** The same tiles as compact rows (the "list" display). */
export const FB_ROW =
  "group flex w-full items-center gap-3 rounded-2xl border-4 p-3 pr-12 text-left text-white transition hover:-translate-y-0.5";

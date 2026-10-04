// Wooden meeple token. Works in server and client components.

export const MEEPLE_PATH =
  "M50 5c-9.4 0-17 7.4-17 16.6 0 5.6 2.7 10.3 7 13.3C28.7 37 10.5 41 6.6 49.2c-2.3 5 1.4 9.6 7.4 9.6 5.2 0 12.6-1.7 17.7-3.1-4.3 9.6-12.8 24.7-15 33.8-.9 4 2 7.5 6 7.5h15.5c2.8 0 5.2-1.6 6.3-4.1L50 79l5.5 13.9c1.1 2.5 3.5 4.1 6.3 4.1h15.5c4 0 6.9-3.5 6-7.5-2.2-9.1-10.7-24.2-15-33.8 5.1 1.4 12.5 3.1 17.7 3.1 6 0 9.7-4.6 7.4-9.6C89.5 41 71.3 37 60 34.9c4.3-3 7-7.7 7-13.3C67 12.4 59.4 5 50 5z";

export function Meeple({
  color = "#d9480f",
  size = 32,
  className = "",
  title,
}: {
  color?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`wood ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={MEEPLE_PATH} style={{ fill: color }} stroke="rgb(0 0 0 / 0.25)" strokeWidth="2.5" strokeLinejoin="round" />
      {/* soft highlight to suggest carved wood */}
      <path
        d="M41 14c4-4 12-4 15 0"
        fill="none"
        stroke="rgb(255 255 255 / 0.45)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Meeple on a round token — used as the member avatar. */
export function MeepleAvatar({ color, size = 40, label }: { color: string; size?: number; label?: string }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full border border-line bg-surface-2"
      style={{ width: size, height: size }}
      title={label}
    >
      <Meeple color={color} size={Math.round(size * 0.72)} title={label} />
    </span>
  );
}

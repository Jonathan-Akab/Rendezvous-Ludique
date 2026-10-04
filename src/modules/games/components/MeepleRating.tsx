import { MEEPLE_PATH } from "@/components/Meeple";

/** Five meeples filled proportionally to a 1–10 score. */
export function MeepleBar({ score, size = 14 }: { score: number | null; size?: number }) {
  const fill = score == null ? 0 : score / 2; // 0–5 meeples
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.max(0, Math.min(1, fill - i)) * 100;
        return (
          <svg key={i} viewBox="0 0 100 100" width={size} height={size}>
            <defs>
              <linearGradient id={`mb-${i}-${Math.round(pct)}`}>
                <stop offset={`${pct}%`} stopColor="var(--accent)" />
                <stop offset={`${pct}%`} stopColor="var(--line)" />
              </linearGradient>
            </defs>
            <path d={MEEPLE_PATH} fill={`url(#mb-${i}-${Math.round(pct)})`} />
          </svg>
        );
      })}
    </span>
  );
}

/** The site's own "meeple rating": average of members' ratings. */
export function MeepleRating({
  avg,
  count,
  label,
  compact = false,
}: {
  avg: number | null;
  count: number;
  label?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent" title={label}>
        <svg viewBox="0 0 100 100" width={11} height={11} aria-hidden>
          <path d={MEEPLE_PATH} fill="currentColor" />
        </svg>
        {avg == null ? "–" : avg.toFixed(1)}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-4xl font-black text-accent">{avg == null ? "–" : avg.toFixed(1)}</span>
      <span className="space-y-0.5">
        <MeepleBar score={avg} size={18} />
        <span className="block text-xs text-muted">{label}</span>
      </span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, Timer } from "lucide-react";
import { clockMs, type DraftClock } from "../draft";

// The game's clock: "Commencer la partie" starts it, pause / resume during the game. It lives
// in the play in progress (server side), so closing the page or the phone doesn't stop it.

const clockText = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Rounded-up minutes on the clock (null before it starts). */
export const clockMinutes = (c: DraftClock, now: number) => {
  const ms = clockMs(c, now);
  return ms > 0 ? Math.max(1, Math.ceil(ms / 60_000)) : null;
};

export function PlayTimer({ clock, onChange }: { clock: DraftClock; onChange: (c: DraftClock) => void }) {
  const t = useTranslations("plays.timer");
  const [now, setNow] = useState(() => Date.now());
  const running = clock.startedAt != null;
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const started = running || clock.savedMs > 0;
  if (!started) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-3">
        <button type="button" onClick={() => onChange({ startedAt: Date.now(), savedMs: 0 })} className="btn btn-primary">
          <Play className="size-4" /> {t("start")}
        </button>
        <p className="min-w-48 flex-1 text-xs text-muted">{t("hint")}</p>
      </div>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${running ? "border-accent/60 bg-accent/10" : "border-line bg-surface-2/50"}`}>
      <Timer className={`size-5 ${running ? "animate-pulse text-accent" : "text-muted"}`} aria-hidden />
      <span className="font-mono text-xl font-bold tabular-nums">{clockText(clockMs(clock, now))}</span>
      <span className="flex-1 text-xs text-muted">{running ? t("running") : t("paused")}</span>
      {running ? (
        <button type="button" onClick={() => onChange({ startedAt: null, savedMs: clockMs(clock, Date.now()) })} className="btn btn-secondary btn-sm">
          <Pause className="size-4" /> {t("pause")}
        </button>
      ) : (
        <button type="button" onClick={() => onChange({ startedAt: Date.now(), savedMs: clock.savedMs })} className="btn btn-secondary btn-sm">
          <Play className="size-4" /> {t("resume")}
        </button>
      )}
    </div>
  );
}

/** Read-only running clock (the "partie en cours" banner). */
export function LiveClock({ clock }: { clock: DraftClock }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (clock.startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clock.startedAt]);
  return (
    <span className="font-mono tabular-nums" suppressHydrationWarning>
      {clockText(clockMs(clock, now))}
    </span>
  );
}

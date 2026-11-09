"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Minus, Plus, UserRound } from "lucide-react";
import { Meeple } from "@/components/Meeple";

export type SeatFriend = { id: string; displayName: string; meepleColor: string };

/**
 * The seats of a game: how many players in all, and who is already coming — friends shown by
 * name, plus seats simply marked as taken ("3 of us already, looking for 1").
 */
export function SeatsFields({
  friends,
  maxPlayers: initialMax,
  reservedSeats: initialReserved = 0,
  friendIds: initialFriends = [],
  joined = 0,
}: {
  friends: SeatFriend[];
  maxPlayers?: number | null;
  reservedSeats?: number;
  friendIds?: string[];
  /** members who joined by themselves (editing): they hold seats too */
  joined?: number;
}) {
  const t = useTranslations("events.seatsForm");
  const [max, setMax] = useState(initialMax != null ? String(initialMax) : "");
  const [reserved, setReserved] = useState(initialReserved);
  const [chosen, setChosen] = useState<string[]>(initialFriends.filter((id) => friends.some((f) => f.id === id)));
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const total = Number.parseInt(max, 10) || 0;
  const taken = 1 + chosen.length + reserved + joined;
  const free = total - taken;

  return (
    <fieldset className="space-y-4 rounded-2xl border border-line/70 bg-surface-2/40 p-4">
      <legend className="px-1 text-sm font-semibold">{t("title")}</legend>
      {chosen.map((id) => (
        <input key={id} type="hidden" name="friendIds" value={id} />
      ))}
      <input type="hidden" name="reservedSeats" value={reserved} />

      <div className="max-w-xs">
        <label className="label" htmlFor="maxPlayers">
          {t("total")}
        </label>
        <input id="maxPlayers" name="maxPlayers" type="number" min={2} className="input" value={max} onChange={(e) => setMax(e.target.value)} placeholder={t("totalHint")} />
      </div>

      <div className="space-y-2">
        <p className="label mb-0">{t("already")}</p>
        {friends.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const on = chosen.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(f.id)}
                  className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition ${on ? "border-accent bg-accent/15 font-semibold" : "border-line bg-surface hover:border-accent/60"}`}
                >
                  <Meeple color={f.meepleColor} size={22} />
                  {f.displayName}
                  {on && <Check className="size-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted">{t("noFriends")}</p>
        )}
        <p className="text-xs text-muted">{t("friendsHint")}</p>
      </div>

      <div className="space-y-1.5">
        <p className="label mb-0">{t("reserved")}</p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm px-2" disabled={reserved <= 0} onClick={() => setReserved((n) => Math.max(0, n - 1))} aria-label={t("less")}>
            <Minus className="size-4" />
          </button>
          <span className="flex min-w-24 items-center justify-center gap-1 text-sm font-semibold">
            {Array.from({ length: Math.min(reserved, 6) }, (_, i) => (
              <UserRound key={i} className="size-4 text-muted" />
            ))}
            {reserved > 6 && <span>+{reserved - 6}</span>}
            {reserved === 0 && <span className="text-muted">0</span>}
          </span>
          <button type="button" className="btn btn-secondary btn-sm px-2" disabled={total > 0 && free <= 0} onClick={() => setReserved((n) => n + 1)} aria-label={t("more")}>
            <Plus className="size-4" />
          </button>
        </div>
        <p className="text-xs text-muted">{t("reservedHint")}</p>
      </div>

      {/* live count: you + friends + taken seats → free seats */}
      <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${total && free < 0 ? "bg-danger/10 text-danger" : total && free === 0 ? "bg-surface-2 text-muted" : "bg-accent/10 text-accent"}`}>
        {t("summary", { friends: chosen.length, reserved, joined })}{" "}
        {total ? (free < 0 ? t("over", { n: -free }) : free === 0 ? t("full") : t("free", { n: free, total })) : t("open", { n: taken })}
      </p>
    </fieldset>
  );
}

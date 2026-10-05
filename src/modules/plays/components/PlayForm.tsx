"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Crown, UserPlus, X } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Meeple } from "@/components/Meeple";
import { logPlayAction } from "../actions";
import { MyGameSelect, type MyGameOption } from "@/modules/kallax/components/MyGameSelect";
import type { ActionState } from "@/lib/forms";

type Friend = { id: string; displayName: string; meepleColor: string };
export type Seat = { key: string; userId?: string; guestName?: string; name: string; color: string; score: string; isWinner: boolean; linked: boolean };

/** Values of an existing play, for the edit form. */
export type PlayEdit = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  ownerId: string;
  gameId: string;
  playedAt: string;
  durationMin: number | null;
  location: string | null;
  notes: string | null;
  seats: Seat[];
};

export function PlayForm({
  me,
  friends,
  games,
  today,
  allowGuests,
  requireConfirmation,
  defaultGame,
  edit,
}: {
  me: Friend;
  friends: Friend[];
  games: MyGameOption[];
  today: string;
  allowGuests: boolean;
  requireConfirmation: boolean;
  /** game id pre-selected (e.g. "log a play" from a Kallax game) */
  defaultGame?: string;
  edit?: PlayEdit;
}) {
  const t = useTranslations("plays");
  const [state, action] = useActionState(edit?.action ?? logPlayAction, undefined);
  const ownerId = edit?.ownerId ?? me.id;
  const [seats, setSeats] = useState<Seat[]>(
    edit?.seats ?? [{ key: me.id, userId: me.id, name: me.displayName, color: me.meepleColor, score: "", isWinner: false, linked: true }],
  );
  const [guest, setGuest] = useState("");

  const available = friends.filter((f) => !seats.some((s) => s.userId === f.id));
  const update = (key: string, patch: Partial<Seat>) => setSeats((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addFriend = (id: string) => {
    const f = friends.find((x) => x.id === id);
    if (f) setSeats((all) => [...all, { key: f.id, userId: f.id, name: f.displayName, color: f.meepleColor, score: "", isWinner: false, linked: true }]);
  };
  const addGuest = () => {
    const name = guest.trim();
    if (!name) return;
    setSeats((all) => [...all, { key: `g-${Date.now()}`, guestName: name, name, color: "#868e96", score: "", isWinner: false, linked: false }]);
    setGuest("");
  };

  const payload = JSON.stringify(
    seats.map((s) => ({
      userId: s.userId,
      guestName: s.guestName,
      score: s.score === "" ? null : Number.parseInt(s.score, 10),
      isWinner: s.isWinner,
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="participants" value={payload} />
      <div>
        <span className="label">{t("form.game")}</span>
        <MyGameSelect games={games} defaultValue={edit?.gameId ?? defaultGame} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="playedAt">
            {t("form.date")}
          </label>
          <input id="playedAt" name="playedAt" type="date" className="input" defaultValue={edit?.playedAt ?? today} max={today} required />
        </div>
        <div>
          <label className="label" htmlFor="durationMin">
            {t("form.duration")}
          </label>
          <input id="durationMin" name="durationMin" type="number" min={1} className="input" defaultValue={edit?.durationMin ?? ""} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="label">{t("form.players")}</legend>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {seats.map((s) => (
              <motion.li
                key={s.key}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-2"
              >
                <Meeple color={s.color} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {s.name}
                  {!s.linked && <span className="ml-1 text-xs font-normal text-muted">({t("guest")})</span>}
                  {s.linked && s.userId !== ownerId && requireConfirmation && !edit?.seats.some((x) => x.userId === s.userId) && (
                    <span className="ml-1 text-xs font-normal text-muted">({t("willConfirm")})</span>
                  )}
                </span>
                <input
                  aria-label={t("form.score")}
                  placeholder={t("form.score")}
                  inputMode="numeric"
                  className="input w-20 py-1"
                  value={s.score}
                  onChange={(e) => update(s.key, { score: e.target.value.replace(/[^\d-]/g, "") })}
                />
                <button
                  type="button"
                  aria-pressed={s.isWinner}
                  title={t("form.winner")}
                  onClick={() => update(s.key, { isWinner: !s.isWinner })}
                  className={`rounded-lg p-1.5 transition ${s.isWinner ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
                >
                  <Crown className="size-4" />
                </button>
                {s.userId !== ownerId && (
                  <button type="button" className="p-1 text-muted hover:text-danger" onClick={() => setSeats((all) => all.filter((x) => x.key !== s.key))}>
                    <X className="size-4" />
                    <span className="sr-only">{t("remove")}</span>
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="flex flex-wrap gap-2">
          {available.length > 0 && (
            <select
              className="select w-auto"
              value=""
              onChange={(e) => addFriend(e.target.value)}
              aria-label={t("form.addFriend")}
            >
              <option value="">+ {t("form.addFriend")}</option>
              {available.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName}
                </option>
              ))}
            </select>
          )}
          {allowGuests && (
            <div className="flex gap-2">
              <input
                className="input w-44"
                placeholder={t("form.guestName")}
                value={guest}
                onChange={(e) => setGuest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGuest();
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={addGuest}>
                <UserPlus className="size-4" /> {t("form.addGuest")}
              </button>
            </div>
          )}
        </div>
        {friends.length === 0 && <p className="text-xs text-muted">{t("form.noFriends")}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="location">
            {t("form.location")}
          </label>
          <input id="location" name="location" className="input" defaultValue={edit?.location ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="notes">
            {t("form.notes")}
          </label>
          <input id="notes" name="notes" className="input" maxLength={500} defaultValue={edit?.notes ?? ""} />
        </div>
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full py-3 sm:w-auto">{edit ? t("form.save") : t("form.submit")}</SubmitButton>
    </form>
  );
}

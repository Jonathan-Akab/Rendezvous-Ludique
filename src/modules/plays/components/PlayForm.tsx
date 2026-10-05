"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { CircleAlert, Crown, Dices, PackagePlus, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Meeple } from "@/components/Meeple";
import { discardPlayDraftAction, logPlayAction, savePlayDraftAction } from "../actions";
import { Popup } from "@/components/Popup";
import type { DraftClock, DraftData, PlayDraftState } from "../draft";
import { MyGameSelect, type MyGameOption } from "@/modules/kallax/components/MyGameSelect";
import type { ActionState } from "@/lib/forms";
import type { MyExpansions } from "@/modules/kallax/service";
import { clockMinutes, PlayTimer } from "./PlayTimer";

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
  expansionIds: string[];
};

export function PlayForm({
  me,
  friends,
  games,
  today,
  allowGuests,
  requireConfirmation,
  defaultGame,
  expansions,
  draft,
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
  /** the logger's expansions, by base game */
  expansions: MyExpansions;
  /** the play in progress, restored when the member comes back */
  draft?: PlayDraftState | null;
  edit?: PlayEdit;
}) {
  const t = useTranslations("plays");
  const [state, action] = useActionState(edit?.action ?? logPlayAction, undefined);
  const ownerId = edit?.ownerId ?? me.id;
  const router = useRouter();
  const d = draft?.data;
  const [seats, setSeats] = useState<Seat[]>(
    edit?.seats ?? d?.seats ?? [{ key: me.id, userId: me.id, name: me.displayName, color: me.meepleColor, score: "", isWinner: false, linked: true }],
  );
  const [guest, setGuest] = useState("");
  const [gameId, setGameId] = useState(edit?.gameId ?? d?.gameId ?? (defaultGame && games.some((g) => g.gameId === defaultGame) ? defaultGame : ""));
  const [chosenExp, setChosenExp] = useState<string[]>(edit?.expansionIds ?? d?.expansionIds ?? []);
  const [duration, setDuration] = useState(edit?.durationMin != null ? String(edit.durationMin) : (d?.duration ?? ""));
  const [playedAt, setPlayedAt] = useState(edit?.playedAt ?? d?.playedAt ?? today);
  const [location, setLocation] = useState(edit?.location ?? d?.location ?? "");
  const [notes, setNotes] = useState(edit?.notes ?? d?.notes ?? "");
  const [clock, setClock] = useState<DraftClock>(draft?.clock ?? { startedAt: null, savedMs: 0 });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const gameExpansions = expansions[gameId] ?? [];

  // ── Play in progress (new plays only): saved on the server as the member goes, so they can
  // close the page and come back to enter the scores at the end.
  const touched = useRef(Boolean(draft)); // nothing is kept until the member does something
  const finished = useRef(false); // saved or cancelled: stop keeping a draft
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot: DraftData = { gameId, playedAt, expansionIds: chosenExp, seats, location, notes, duration };
  const snapshotJson = JSON.stringify(snapshot);
  const persist = (c: DraftClock = clock) => {
    if (edit || finished.current || !touched.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void savePlayDraftAction(JSON.parse(snapshotJson), c);
  };
  useEffect(() => {
    if (edit || finished.current || !touched.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void savePlayDraftAction(JSON.parse(snapshotJson), clock), 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [snapshotJson, clock, edit]);
  // leaving the tab: write right away rather than after the short delay
  useEffect(() => {
    const flush = () => document.visibilityState === "hidden" && persist();
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  });
  // a refused "Noter cette partie" (missing game…) keeps the draft going
  useEffect(() => {
    if (state?.error) finished.current = false;
  }, [state]);
  const touch = () => {
    touched.current = true;
  };
  // the clock fills the length (in minutes) as it runs
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (clock.startedAt == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [clock.startedAt]);
  useEffect(() => {
    const min = clockMinutes(clock, Date.now());
    if (min != null) setDuration(String(min));
  }, [clock, tick]);
  const changeClock = (c: DraftClock) => {
    touch();
    setClock(c);
    persist(c);
  };
  // "Jouer": keep the play in progress (the clock starts if it hasn't) and leave the page
  const [leaving, setLeaving] = useState(false);
  const keepPlaying = async () => {
    setLeaving(true);
    touched.current = true;
    const c = clock.startedAt == null && clock.savedMs === 0 ? { startedAt: Date.now(), savedMs: 0 } : clock;
    finished.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await savePlayDraftAction(JSON.parse(snapshotJson), c);
    router.push("/plays");
  };
  const cancelPlay = async () => {
    finished.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await discardPlayDraftAction();
    router.push("/plays");
  };

  const available = friends.filter((f) => !seats.some((s) => s.userId === f.id));
  const update = (key: string, patch: Partial<Seat>) => (touch(), setSeats((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s))));
  const addFriend = (id: string) => {
    const f = friends.find((x) => x.id === id);
    touch();
    if (f) setSeats((all) => [...all, { key: f.id, userId: f.id, name: f.displayName, color: f.meepleColor, score: "", isWinner: false, linked: true }]);
  };
  const addGuest = () => {
    const name = guest.trim();
    if (!name) return;
    touch();
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
    <form
      action={action}
      className="space-y-6"
      onSubmit={() => {
        finished.current = true;
        if (saveTimer.current) clearTimeout(saveTimer.current);
      }}
    >
      <input type="hidden" name="participants" value={payload} />
      {draft && !edit && (
        <p className="flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
          <RotateCcw className="size-4" /> {t("draft.restored")}
        </p>
      )}
      <div>
        <span className="label">{t("form.game")}</span>
        <MyGameSelect
          games={games}
          defaultValue={edit?.gameId ?? (gameId || undefined)}
          required
          onChange={(ids) => {
            touch();
            setGameId(ids[0] ?? "");
            setChosenExp([]);
          }}
        />
      </div>
      {gameExpansions.length > 0 && (
        <fieldset>
          <legend className="label">{t("form.expansions")}</legend>
          <div className="flex flex-wrap gap-2">
            {gameExpansions.map((x) => {
              const on = chosenExp.includes(x.gameId);
              return (
                <label
                  key={x.gameId}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${on ? "border-accent bg-accent/10 font-semibold" : "border-line hover:border-accent/60"}`}
                >
                  <input
                    type="checkbox"
                    name="expansionIds"
                    value={x.gameId}
                    checked={on}
                    onChange={() => (touch(), setChosenExp(on ? chosenExp.filter((id) => id !== x.gameId) : [...chosenExp, x.gameId]))}
                    className="sr-only"
                  />
                  <PackagePlus className={`size-4 ${on ? "text-accent" : "text-muted"}`} aria-hidden />
                  {x.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="playedAt">
            {t("form.date")}
          </label>
          <input id="playedAt" name="playedAt" type="date" className="input" value={playedAt} onChange={(e) => (touch(), setPlayedAt(e.target.value))} max={today} required />
        </div>
        <div>
          <label className="label" htmlFor="durationMin">
            {t("form.duration")}
          </label>
          <input id="durationMin" name="durationMin" type="number" min={1} className="input" value={duration} onChange={(e) => (touch(), setDuration(e.target.value))} />
        </div>
      </div>
      {!edit && <PlayTimer clock={clock} onChange={changeClock} />}

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
                  <button type="button" className="p-1 text-muted hover:text-danger" onClick={() => (touch(), setSeats((all) => all.filter((x) => x.key !== s.key)))}>
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
          <input id="location" name="location" className="input" value={location} onChange={(e) => (touch(), setLocation(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="notes">
            {t("form.notes")}
          </label>
          <input id="notes" name="notes" className="input" maxLength={500} value={notes} onChange={(e) => (touch(), setNotes(e.target.value))} />
        </div>
      </div>

      <FormMessage state={state} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {!edit && (
          <button type="button" className="btn btn-ghost py-3 text-danger" onClick={() => setConfirmCancel(true)}>
            <Trash2 className="size-4" /> {t("draft.cancel")}
          </button>
        )}
        {!edit && (
          <button type="button" className="btn btn-secondary py-3 sm:ml-auto" onClick={() => void keepPlaying()} disabled={leaving} title={t("draft.playHint")}>
            <Dices className="size-4" /> {t("draft.play")}
          </button>
        )}
        <SubmitButton className={`btn btn-primary w-full py-3 sm:w-auto ${edit ? "sm:ml-auto" : ""}`}>{edit ? t("form.save") : t("form.submit")}</SubmitButton>
      </div>
      {!edit && (
        <Popup open={confirmCancel} onClose={() => setConfirmCancel(false)} title={t("draft.confirmTitle")} icon={<CircleAlert className="size-5" />} closeLabel={t("draft.no")}>
          <p className="text-sm">{t("draft.confirmText")}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)} autoFocus>
              {t("draft.no")}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void cancelPlay()}>
              <Trash2 className="size-4" /> {t("draft.yes")}
            </button>
          </div>
        </Popup>
      )}
    </form>
  );
}

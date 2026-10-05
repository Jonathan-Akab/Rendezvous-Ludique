"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, BookmarkPlus, Check, ChevronDown, Clock, Dices, Gauge, GripVertical, Minus, NotebookPen, Plus, RotateCcw, SlidersHorizontal, Star, Users, X } from "lucide-react";
import { GameCover } from "@/modules/games/components/GameCover";
import type { PickerGame } from "../service";
import { GAME_TYPES, LENGTHS, LEVELS, lengthOf, type GameType, type Length, type Level } from "../gameTypes";
import { savePickerPresetsAction } from "../actions";
import { useRoll } from "./useRoll";
import { Flash, Stage, useStored } from "./parts";

type Party = "" | "yes" | "no";
type Filters = {
  players: string;
  lengths: Length[];
  levels: Level[];
  party: Party;
  types: GameType[];
  age: string;
  since: string;
  minRating: string;
  mineOnly: boolean;
  withExpansions: boolean;
  favorLessPlayed: boolean;
};
const NO_FILTERS: Filters = { players: "", lengths: [], levels: [], party: "", types: [], age: "", since: "", minRating: "", mineOnly: false, withExpansions: false, favorLessPlayed: false };
const DAY = 86_400_000;
const MAX_PLAYERS = 12;
// Party has its own yes/no switch; the rest are "any of these" chips.
const TYPE_CHOICES = GAME_TYPES.filter((x) => x !== "PARTY");

export type PickerPreset = { name: string; filters: Partial<Filters> };

// Ready-made filter sets (names in picker.presets.*).
const BUILT_IN: { key: string; filters: Partial<Filters> }[] = [
  { key: "party", filters: { party: "yes", lengths: ["QUICK", "SHORT"] } },
  { key: "quick", filters: { lengths: ["QUICK"], levels: ["LIGHT"] } },
  { key: "family", filters: { types: ["FAMILY", "KIDS"], party: "no" } },
  { key: "duo", filters: { players: "2" } },
  { key: "solo", filters: { players: "1" } },
  { key: "coop", filters: { types: ["COOP"] } },
  { key: "expert", filters: { levels: ["HEAVY"], party: "no" } },
  { key: "forgotten", filters: { since: "6", favorLessPlayed: true } },
  { key: "never", filters: { since: "never" } },
];

// Filter blocks, in the default order (each member can rearrange them for now).
const SECTIONS = ["players", "party", "length", "level", "types", "age", "since", "rating", "options"] as const;
type SectionKey = (typeof SECTIONS)[number];
const WIDE = new Set<SectionKey>(["types", "options"]);

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface-2/60 text-muted hover:border-accent/60 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {children}
    </label>
  );
}

export function GamePick({ games, playsEnabled, now, presets: initialPresets }: { games: PickerGame[]; playsEnabled: boolean; now: number; presets: PickerPreset[] }) {
  const t = useTranslations("picker.game");
  const tt = useTranslations("picker.types");
  const tp = useTranslations("picker.presets");
  const [stored, setF] = useStored<Filters>("rl-picker-filters-v2", NO_FILTERS);
  const f = { ...NO_FILTERS, ...stored };
  const [storedOrder, setOrder] = useStored<SectionKey[]>("rl-picker-order", [...SECTIONS]);
  // keep only known blocks, and add any block missing from an older saved order
  const order = [...storedOrder.filter((k) => SECTIONS.includes(k)), ...SECTIONS.filter((k) => !storedOrder.includes(k))];
  const [arranging, setArranging] = useState(false);
  const [presets, setPresets] = useState(initialPresets);
  const [menuOpen, setMenuOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [presetName, setPresetName] = useState("");
  const { shown, result, rolling, roll } = useRoll<PickerGame>();
  const shared = games.some((g) => !g.mine);

  const candidates = useMemo(() => {
    const n = Number.parseInt(f.players, 10);
    const age = Number.parseInt(f.age, 10);
    const minRating = Number.parseFloat(f.minRating);
    return games.filter((g) => {
      if (n > 0 && ((g.minPlayers ?? 1) > n || (g.maxPlayers ?? 99) < n)) return false;
      if (f.lengths.length && !f.lengths.includes(lengthOf(g.playTimeMin) as Length)) return false;
      if (f.levels.length && !f.levels.includes(g.level as Level)) return false;
      if (f.party === "yes" && !g.types.includes("PARTY")) return false;
      if (f.party === "no" && g.types.includes("PARTY")) return false;
      if (f.types.length && !f.types.some((x) => g.types.includes(x))) return false;
      if (age > 0 && (g.minAge == null || g.minAge > age)) return false;
      if (minRating > 0 && (g.rating == null || g.rating < minRating)) return false;
      if (f.since === "never" && g.lastPlayed) return false;
      if (f.since && f.since !== "never" && g.lastPlayed && now - Date.parse(g.lastPlayed) < Number(f.since) * 30 * DAY) return false;
      if (f.mineOnly && !g.mine) return false;
      if (f.withExpansions && !g.hasExpansions) return false;
      return true;
    });
  }, [games, stored, now]); // eslint-disable-line react-hooks/exhaustive-deps -- f is derived from stored

  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...NO_FILTERS, ...prev, ...patch }));
  const flip = <K extends "lengths" | "levels" | "types">(key: K, value: Filters[K][number]) =>
    setF((prev) => {
      const cur = { ...NO_FILTERS, ...prev };
      return { ...cur, [key]: toggle(cur[key] as Filters[K][number][], value) };
    });
  // − from 1 goes back to "any"; reads the latest value so quick clicks all count
  const stepPlayers = (delta: number) =>
    setF((prev) => {
      const n = (Number.parseInt(prev.players ?? "", 10) || 0) + delta;
      return { ...NO_FILTERS, ...prev, players: n >= 1 ? String(Math.min(n, MAX_PLAYERS)) : "" };
    });
  const active = [f.players, f.lengths.length, f.levels.length, f.party, f.types.length, f.age, f.since, f.minRating, f.mineOnly, f.withExpansions, f.favorLessPlayed].filter(Boolean).length;

  // Presets: ready-made ones, and the member's own (saved on their profile).
  const applyPreset = (filters: Partial<Filters>) => {
    setF({ ...NO_FILTERS, ...filters });
    setMenuOpen(false);
  };
  const savePresets = (next: PickerPreset[]) => {
    setPresets(next);
    void savePickerPresetsAction(next);
  };
  const saveCurrent = () => {
    const name = presetName.trim();
    if (!name) return;
    // only what differs from "no filter", so the saved set stays small
    const filters = Object.fromEntries(Object.entries(f).filter(([, v]) => (Array.isArray(v) ? v.length : Boolean(v)))) as Partial<Filters>;
    savePresets([...presets.filter((p) => p.name !== name), { name, filters }].slice(-12));
    setNaming(false);
    setPresetName("");
  };

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (!games.length) return <p className="card card-pad text-sm text-muted">{t("empty")}</p>;

  const lastPlayed = (g: PickerGame) => {
    if (!g.lastPlayed) return t("neverPlayed");
    const days = Math.floor((now - Date.parse(g.lastPlayed)) / DAY);
    return days < 1 ? t("playedToday") : days < 60 ? t("playedDays", { n: days }) : t("playedMonths", { n: Math.floor(days / 30) });
  };
  // "favour the less played": a game played 3 times is 4× less likely than one never played
  const rollNow = () => roll(candidates, undefined, f.favorLessPlayed ? (g) => 1 / (1 + g.playCount) : undefined);
  const players = Number.parseInt(f.players, 10) || 0;

  const sections: Record<SectionKey, { title: string; body: ReactNode }> = {
    players: {
      title: t("players"),
      body: (
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm px-2" disabled={!players} onClick={() => stepPlayers(-1)} aria-label={t("fewerPlayers")}>
            <Minus className="size-4" />
          </button>
          <span className={`min-w-28 text-center text-sm font-semibold ${players ? "text-accent" : "text-muted"}`}>{players ? t("playersN", { n: players }) : t("any")}</span>
          <button type="button" className="btn btn-secondary btn-sm px-2" disabled={players >= MAX_PLAYERS} onClick={() => stepPlayers(1)} aria-label={t("morePlayers")}>
            <Plus className="size-4" />
          </button>
        </div>
      ),
    },
    party: {
      title: t("party"),
      body: (
        <div className="flex flex-wrap gap-1.5">
          {(["", "yes", "no"] as Party[]).map((p) => (
            <Chip key={p || "any"} on={f.party === p} onClick={() => set({ party: p })}>
              {t(`partyChoice.${p || "any"}`)}
            </Chip>
          ))}
        </div>
      ),
    },
    length: {
      title: t("length"),
      body: (
        <div className="flex flex-wrap gap-1.5">
          {LENGTHS.map((l) => (
            <Chip key={l} on={f.lengths.includes(l)} onClick={() => flip("lengths", l)}>
              {t(`lengths.${l}`)}
            </Chip>
          ))}
        </div>
      ),
    },
    level: {
      title: t("level"),
      body: (
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <Chip key={l} on={f.levels.includes(l)} onClick={() => flip("levels", l)}>
              {t(`levels.${l}`)}
            </Chip>
          ))}
        </div>
      ),
    },
    types: {
      title: t("types"),
      body: (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_CHOICES.map((x) => (
              <Chip key={x} on={f.types.includes(x)} onClick={() => flip("types", x)}>
                {tt(x)}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">{t("typesHint")}</p>
        </>
      ),
    },
    age: {
      title: t("age"),
      body: (
        <select className="select" value={f.age} onChange={(e) => set({ age: e.target.value })} aria-label={t("age")}>
          <option value="">{t("any")}</option>
          {[5, 6, 8, 10, 12, 14].map((a) => (
            <option key={a} value={a}>
              {t("ageYears", { n: a })}
            </option>
          ))}
        </select>
      ),
    },
    since: {
      title: t("since"),
      body: (
        <select className="select" value={f.since} onChange={(e) => set({ since: e.target.value })} aria-label={t("since")}>
          <option value="">{t("any")}</option>
          {[1, 3, 6, 12].map((m) => (
            <option key={m} value={m}>
              {t("sinceMonths", { n: m })}
            </option>
          ))}
          <option value="never">{t("never")}</option>
        </select>
      ),
    },
    rating: {
      title: t("minRating"),
      body: (
        <select className="select" value={f.minRating} onChange={(e) => set({ minRating: e.target.value })} aria-label={t("minRating")}>
          <option value="">{t("any")}</option>
          {[5, 6, 7, 8, 9].map((r) => (
            <option key={r} value={r}>
              {t("ratingAtLeast", { n: r })}
            </option>
          ))}
        </select>
      ),
    },
    options: {
      title: t("options"),
      body: (
        <div className="space-y-2">
          {shared && (
            <Toggle checked={f.mineOnly} onChange={(v) => set({ mineOnly: v })}>
              {t("mineOnly")}
            </Toggle>
          )}
          <Toggle checked={f.withExpansions} onChange={(v) => set({ withExpansions: v })}>
            {t("withExpansions")}
          </Toggle>
          <Toggle checked={f.favorLessPlayed} onChange={(v) => set({ favorLessPlayed: v })}>
            {t("favorLessPlayed")}
          </Toggle>
          <p className="text-xs text-muted">{t("unknownHint")}</p>
        </div>
      ),
    },
  };
  const move = (key: SectionKey, delta: number) => {
    const i = order.indexOf(key);
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* the result first on phones, on the right on large screens */}
      <div className="space-y-4 lg:sticky lg:top-24 lg:order-2">
        <Stage rolling={rolling} idle={t("idle")}>
          {shown && (
            <div className="flex flex-col items-center gap-3">
              <motion.div key={shown.gameId} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}>
                <GameCover name={shown.name} src={shown.cover} size="md" />
              </motion.div>
              <Flash
                text={shown.name}
                rolling={rolling}
                sub={
                  result && (
                    <div className="flex flex-wrap justify-center gap-1.5 text-xs text-muted">
                      {(result.minPlayers || result.maxPlayers) && (
                        <span className="chip">
                          <Users className="size-3" /> {result.minPlayers === result.maxPlayers ? result.minPlayers : `${result.minPlayers ?? 1}–${result.maxPlayers ?? "?"}`}
                        </span>
                      )}
                      {result.playTimeMin && (
                        <span className="chip">
                          <Clock className="size-3" /> {result.playTimeMin} min
                        </span>
                      )}
                      {result.level && (
                        <span className="chip">
                          <Gauge className="size-3" /> {t(`levels.${result.level}`)}
                        </span>
                      )}
                      {result.rating != null && (
                        <span className="chip">
                          <Star className="size-3" /> {result.rating}/10
                        </span>
                      )}
                      <span className="chip">{lastPlayed(result)}</span>
                      {result.types.slice(0, 3).map((x) => (
                        <span key={x} className="chip chip-accent">
                          {tt(x)}
                        </span>
                      ))}
                    </div>
                  )
                }
              />
            </div>
          )}
        </Stage>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!candidates.length || rolling} onClick={rollNow}>
            {result ? <RotateCcw className="size-4" /> : <Dices className="size-4" />}
            {result ? t("again") : t("roll")}
          </button>
          {result && !rolling && playsEnabled && (
            <Link href={`/plays/new?game=${result.gameId}`} className="btn btn-secondary">
              <NotebookPen className="size-4" /> {t("logPlay")}
            </Link>
          )}
        </div>
        <p className={`text-sm ${candidates.length ? "text-muted" : "font-semibold text-danger"}`}>{candidates.length ? t("count", { n: candidates.length }) : t("none")}</p>
      </div>

      <div className="card card-pad space-y-5 lg:order-1">
        {/* header: title, presets, save, clear, arrange */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section-title mr-auto flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-accent" /> {t("filters")}
            {active > 0 && <span className="chip chip-accent">{active}</span>}
          </h2>
          <div className="relative" ref={menuRef}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
              <Bookmark className="size-4" /> {tp("choose")} <ChevronDown className="size-3.5" />
            </button>
            {menuOpen && (
              <div className="card absolute right-0 z-30 mt-2 w-72 space-y-3 p-3 shadow-2xl">
                <div>
                  <p className="label">{tp("builtIn")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BUILT_IN.map((p) => (
                      <Chip key={p.key} on={false} onClick={() => applyPreset(p.filters)}>
                        {tp(`names.${p.key}`)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="label">{tp("mine")}</p>
                  {presets.length === 0 ? (
                    <p className="text-xs text-muted">{tp("noneSaved")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {presets.map((p) => (
                        <li key={p.name} className="flex items-center gap-1">
                          <button type="button" onClick={() => applyPreset(p.filters)} className="flex-1 truncate rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-2">
                            {p.name}
                          </button>
                          <button type="button" onClick={() => savePresets(presets.filter((x) => x.name !== p.name))} className="rounded p-1 text-muted hover:text-danger" aria-label={tp("delete", { name: p.name })}>
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!active} onClick={() => setNaming(true)} title={tp("saveHint")}>
            <BookmarkPlus className="size-4" /> {tp("save")}
          </button>
          <button type="button" className={`btn btn-sm ${arranging ? "btn-primary" : "btn-ghost"}`} onClick={() => setArranging(!arranging)} title={t("arrangeHint")}>
            {arranging ? <Check className="size-4" /> : <ArrowUpDown className="size-4" />}
            {arranging ? t("arrangeDone") : t("arrange")}
          </button>
          {active > 0 && (
            <button type="button" onClick={() => setF(NO_FILTERS)} className="text-xs text-muted underline hover:text-ink">
              {t("clear")}
            </button>
          )}
        </div>

        {naming && (
          <form
            className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveCurrent();
            }}
          >
            <input autoFocus className="input min-w-40 flex-1 py-1.5" maxLength={40} placeholder={tp("namePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!presetName.trim()}>
              {tp("saveConfirm")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNaming(false)}>
              {tp("cancel")}
            </button>
          </form>
        )}

        {arranging ? (
          <>
            <p className="text-xs text-muted">{t("arrangeHelp")}</p>
            <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
              {order.map((key, i) => (
                <ArrangeItem key={key} value={key} title={sections[key].title} first={i === 0} last={i === order.length - 1} onMove={(d) => move(key, d)} upLabel={t("moveUp")} downLabel={t("moveDown")} />
              ))}
            </Reorder.Group>
            <button type="button" className="text-xs text-muted underline hover:text-ink" onClick={() => setOrder([...SECTIONS])}>
              {t("arrangeReset")}
            </button>
          </>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {order.map((key) => (
              <div key={key} className={`space-y-2 ${WIDE.has(key) ? "sm:col-span-2" : ""}`}>
                <p className="label mb-0">{sections[key].title}</p>
                {sections[key].body}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One filter block while arranging: drag it by the handle, or use the arrows. */
function ArrangeItem({ value, title, first, last, onMove, upLabel, downLabel }: { value: SectionKey; title: string; first: boolean; last: boolean; onMove: (delta: number) => void; upLabel: string; downLabel: string }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={value} dragListener={false} dragControls={controls} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-2 py-2 text-sm font-semibold">
      <button type="button" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none rounded p-1 text-muted hover:text-ink active:cursor-grabbing" aria-hidden tabIndex={-1}>
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1">{title}</span>
      <button type="button" disabled={first} onClick={() => onMove(-1)} className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" aria-label={upLabel}>
        <ArrowUp className="size-4" />
      </button>
      <button type="button" disabled={last} onClick={() => onMove(1)} className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" aria-label={downLabel}>
        <ArrowDown className="size-4" />
      </button>
    </Reorder.Item>
  );
}

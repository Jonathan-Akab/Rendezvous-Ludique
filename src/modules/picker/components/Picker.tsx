"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Crown, Dices, Gamepad2, ListPlus, Trash2, UserPlus, X } from "lucide-react";
import type { PickerGame } from "../service";
import { shuffle, useRoll } from "./useRoll";
import { Flash, Stage, useStored } from "./parts";
import { GamePick, type PickerPreset } from "./GamePick";

type Tab = "game" | "list" | "first";
type Friend = { id: string; displayName: string };

export function Picker({
  games,
  friends,
  me,
  playsEnabled,
  now,
  initialTab,
  presets,
}: {
  games: PickerGame[];
  friends: Friend[];
  me: string;
  playsEnabled: boolean;
  now: number;
  initialTab: Tab;
  presets: PickerPreset[];
}) {
  const t = useTranslations("picker");
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: { key: Tab; icon: ReactNode }[] = [
    { key: "game", icon: <Gamepad2 className="size-4" /> },
    { key: "list", icon: <ListPlus className="size-4" /> },
    { key: "first", icon: <Crown className="size-4" /> },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`btn btn-sm ${tab === x.key ? "btn-primary" : "btn-secondary"}`}
          >
            {x.icon}
            {t(`tabs.${x.key}`)}
          </button>
        ))}
      </div>
      {tab === "game" && <GamePick games={games} playsEnabled={playsEnabled} now={now} presets={presets} />}
      {tab === "list" && <ListPick games={games} />}
      {tab === "first" && <FirstPlayer friends={friends} me={me} />}
    </div>
  );
}

// ───────────────────────── Draw from my own list ─────────────────────────

function ListPick({ games }: { games: PickerGame[] }) {
  const t = useTranslations("picker.list");
  const [items, setItems] = useStored<string[]>("rl-picker-list", []);
  const [removeWinner, setRemoveWinner] = useStored<boolean>("rl-picker-remove", false);
  const [text, setText] = useState("");
  const { shown, result, rolling, roll, reset } = useRoll<string>();

  const add = (value: string) => {
    const v = value.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
  };
  const addText = () => {
    // "Catan, Azul, Splendor" adds three choices at once
    const parts = text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...items];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    setItems(next);
    setText("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="card card-pad space-y-4">
        <h2 className="section-title">{t("choices")}</h2>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder={t("placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addText();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={addText} title={t("add")}>
            <ListPlus className="size-4" />
          </button>
        </div>
        {games.length > 0 && (
          <select className="select" value="" onChange={(e) => add(e.target.value)} aria-label={t("fromKallax")}>
            <option value="">+ {t("fromKallax")}</option>
            {games
              .filter((g) => !items.includes(g.name))
              .map((g) => (
                <option key={g.gameId} value={g.name}>
                  {g.name}
                </option>
              ))}
          </select>
        )}
        <ul className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li key={item} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="chip gap-1 pr-1">
                {item}
                <button type="button" onClick={() => setItems(items.filter((x) => x !== item))} className="rounded p-0.5 text-muted hover:text-danger" aria-label={t("remove", { name: item })}>
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {items.length === 0 && <p className="text-xs text-muted">{t("emptyHint")}</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={removeWinner} onChange={(e) => setRemoveWinner(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          {t("removeWinner")}
        </label>
        {items.length > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
            onClick={() => {
              setItems([]);
              reset();
            }}
          >
            <Trash2 className="size-3.5" /> {t("clear")}
          </button>
        )}
      </div>
      <div className="space-y-4">
        <Stage rolling={rolling} idle={t("idle")}>
          {shown && <Flash text={shown} rolling={rolling} sub={result && <p className="text-sm text-muted">{t("winner")}</p>} />}
        </Stage>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={items.length < 2 || rolling}
            onClick={() => roll(items, (winner) => removeWinner && setItems(items.filter((x) => x !== winner)))}
          >
            <Dices className="size-4" /> {result ? t("again") : t("roll")}
          </button>
          {items.length < 2 && <span className="text-sm text-muted">{t("needTwo")}</span>}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Who starts? ─────────────────────────

function FirstPlayer({ friends, me }: { friends: Friend[]; me: string }) {
  const t = useTranslations("picker.first");
  const [players, setPlayers] = useStored<string[]>("rl-picker-players", [me]);
  const [text, setText] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const { shown, result, rolling, roll } = useRoll<string>();

  const add = (name: string) => {
    const v = name.trim();
    if (v && !players.includes(v)) setPlayers([...players, v]);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="card card-pad space-y-4">
        <h2 className="section-title">{t("players")}</h2>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder={t("placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
                setText("");
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            title={t("add")}
            onClick={() => {
              add(text);
              setText("");
            }}
          >
            <UserPlus className="size-4" />
          </button>
        </div>
        {friends.some((f) => !players.includes(f.displayName)) && (
          <select className="select" value="" onChange={(e) => add(e.target.value)} aria-label={t("addFriend")}>
            <option value="">+ {t("addFriend")}</option>
            {friends
              .filter((f) => !players.includes(f.displayName))
              .map((f) => (
                <option key={f.id} value={f.displayName}>
                  {f.displayName}
                </option>
              ))}
          </select>
        )}
        <ul className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {players.map((p) => (
              <motion.li key={p} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="chip gap-1 pr-1">
                {p}
                <button type="button" onClick={() => setPlayers(players.filter((x) => x !== p))} className="rounded p-0.5 text-muted hover:text-danger" aria-label={t("remove", { name: p })}>
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
      <div className="space-y-4">
        <Stage rolling={rolling} idle={t("idle")}>
          {shown && (
            <Flash
              text={rolling ? shown : t("starts", { name: shown })}
              rolling={rolling}
              sub={
                result &&
                order.length > 2 && (
                  <ol className="mx-auto mt-2 flex flex-wrap justify-center gap-2 text-sm">
                    {order.map((p, i) => (
                      <li key={p} className="chip">
                        <span className="font-bold text-accent">{i + 1}.</span> {p}
                      </li>
                    ))}
                  </ol>
                )
              }
            />
          )}
        </Stage>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={players.length < 2 || rolling}
            onClick={() => roll(players, (first) => setOrder([first, ...shuffle(players.filter((p) => p !== first))]))}
          >
            <Crown className="size-4" /> {result ? t("again") : t("roll")}
          </button>
          {players.length < 2 ? <span className="text-sm text-muted">{t("needTwo")}</span> : <span className="text-sm text-muted">{t("orderHint")}</span>}
        </div>
      </div>
    </div>
  );
}

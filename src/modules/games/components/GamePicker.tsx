"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Clock, LoaderCircle, Plus, Search, Users, X } from "lucide-react";
import { GameCover } from "./GameCover";
import { MeepleRating } from "./MeepleRating";
import { GameFields } from "./GameFields";

export type PickedGame = {
  id: string;
  name: string;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  designer: string | null;
  cover: string | null;
  owners: number;
  rating: { avg: number | null; count: number };
};

/**
 * Search the site's game database as you type. Picking a result submits `gameId`;
 * a name that isn't in the database can be created with its details (`game.*` fields).
 */
export function GamePicker({
  allowCreate = true,
  onPick,
  fieldName = "gameId",
  createHref,
  initial,
}: {
  allowCreate?: boolean;
  onPick?: (g: PickedGame | null) => void;
  fieldName?: string;
  /** when set, "create" navigates there instead of showing inline fields */
  createHref?: (name: string) => string;
  /** game already chosen (e.g. selling a game from your kallax) */
  initial?: PickedGame | null;
}) {
  const t = useTranslations("games.picker");
  const listId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<PickedGame | null>(initial ?? null);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (picked || creating || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/games/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: PickedGame[]) => {
          setResults(data);
          setActive(0);
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, picked, creating]);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const exact = results.some((r) => r.name.toLowerCase() === q.trim().toLowerCase());
  const options = [...results.map((r) => ({ kind: "game" as const, game: r })), ...(allowCreate && q.trim() && !exact ? [{ kind: "create" as const }] : [])];

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.kind === "game") {
      setPicked(o.game);
      onPick?.(o.game);
    } else if (createHref) {
      window.location.assign(createHref(q.trim()));
    } else {
      setCreating(true);
      onPick?.(null);
    }
    setOpen(false);
  };
  const reset = () => {
    setPicked(null);
    setCreating(false);
    onPick?.(null);
  };

  if (picked) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 rounded-2xl border border-accent/50 bg-accent/5 p-3">
        <input type="hidden" name={fieldName} value={picked.id} />
        <GameCover name={picked.name} src={picked.cover} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">
            {picked.name} {picked.year && <span className="text-sm font-normal text-muted">({picked.year})</span>}
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs text-muted">
            {picked.minPlayers && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {picked.minPlayers}–{picked.maxPlayers}
              </span>
            )}
            {picked.playTimeMin && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {picked.playTimeMin}′
              </span>
            )}
            {picked.designer && <span>{picked.designer}</span>}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <MeepleRating avg={picked.rating.avg} count={picked.rating.count} compact label={t("rating")} />
            {t("owners", { count: picked.owners })}
          </div>
        </div>
        <button type="button" onClick={reset} className="rounded-lg p-1 text-muted hover:text-ink" title={t("change")}>
          <X className="size-4" />
        </button>
      </motion.div>
    );
  }

  if (creating) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl border border-dashed border-accent/60 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            <Plus className="mr-1 inline size-4 text-accent" />
            {t("newGame")}
          </p>
          <button type="button" onClick={reset} className="text-xs text-muted underline">
            {t("backToSearch")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("newGameHint")}</p>
        <GameFields prefix="game." values={{ name: q.trim() }} compact />
      </motion.div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              // never submit the surrounding form from the search box
              e.preventDefault();
              if (options.length) choose(open ? active : 0);
            }
          }}
          placeholder={t("placeholder")}
          className="input py-3 pl-9 text-base"
          autoComplete="off"
        />
        {loading && <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="glass absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl p-1.5"
          >
            {options.map((o, i) => (
              <li
                key={o.kind === "game" ? o.game.id : "create"}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(i);
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 ${i === active ? "bg-accent/15" : ""}`}
              >
                {o.kind === "game" ? (
                  <>
                    <GameCover name={o.game.name} src={o.game.cover} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {o.game.name} {o.game.year && <span className="font-normal text-muted">({o.game.year})</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {o.game.minPlayers ? `${o.game.minPlayers}–${o.game.maxPlayers} · ` : ""}
                        {o.game.playTimeMin ? `${o.game.playTimeMin}′ · ` : ""}
                        {t("owners", { count: o.game.owners })}
                      </p>
                    </div>
                    <MeepleRating avg={o.game.rating.avg} count={o.game.rating.count} compact label={t("rating")} />
                  </>
                ) : (
                  <span className="flex items-center gap-2 px-1 py-1 text-sm font-semibold text-accent">
                    <Plus className="size-4" /> {t("create", { name: q.trim() })}
                  </span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

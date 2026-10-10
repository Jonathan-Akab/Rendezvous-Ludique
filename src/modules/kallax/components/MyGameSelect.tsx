"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, LibraryBig, Search, X } from "lucide-react";
import { GameCover } from "@/modules/games/components/GameCover";

export type MyGameOption = { gameId: string; name: string; cover: string | null };

/**
 * Choose a game from your own Kallax. Single mode submits `name` (a game id); multiple
 * mode submits one `name` field per chosen game.
 */
export function MyGameSelect({
  games,
  name = "gameId",
  defaultValue,
  multiple = false,
  required = false,
  onChange,
  showCovers = true,
}: {
  games: MyGameOption[];
  name?: string;
  defaultValue?: string | string[];
  multiple?: boolean;
  required?: boolean;
  onChange?: (ids: string[]) => void;
  /** false: names only, without the box pictures */
  showCovers?: boolean;
}) {
  const t = useTranslations("kallax.pick");
  const initial = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  const [selected, setSelected] = useState<string[]>(initial.filter((id) => games.some((g) => g.gameId === id)));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!initial.length);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? games.filter((g) => g.name.toLowerCase().includes(s)) : games;
  }, [games, q]);

  const update = (ids: string[]) => {
    setSelected(ids);
    onChange?.(ids);
  };
  const toggle = (id: string) => {
    if (multiple) update(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else {
      update([id]);
      setOpen(false);
    }
  };

  if (games.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
        <LibraryBig className="size-4" /> {t("empty")}
        <Link href="/kallax" className="link">
          {t("goKallax")}
        </Link>
      </p>
    );
  }

  const chosen = games.filter((g) => selected.includes(g.gameId));
  return (
    <div className="space-y-2">
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {/* keeps the browser's "required" check working when nothing is chosen */}
      {required && selected.length === 0 && <input tabIndex={-1} aria-hidden className="sr-only" required value="" onChange={() => {}} />}

      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chosen.map((g) => (
            <span key={g.gameId} className="flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 py-1 pl-1 pr-2 text-sm font-semibold">
              {showCovers && <GameCover name={g.name} src={g.cover} size="xs" />}
              {g.name}
              <button type="button" onClick={() => (multiple ? toggle(g.gameId) : (update([]), setOpen(true)))} className="text-muted hover:text-danger" aria-label={t("remove", { name: g.name })}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {!multiple && !open && (
            <button type="button" className="text-xs text-muted underline" onClick={() => setOpen(true)}>
              {t("change")}
            </button>
          )}
        </div>
      )}

      {(open || multiple) && (
        <div className="rounded-2xl border border-line/70 bg-bg/50 p-2">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="input py-1.5 pl-9" aria-label={t("search")} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
          </div>
          <ul className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2" role="listbox" aria-multiselectable={multiple}>
            {filtered.map((g) => {
              const on = selected.includes(g.gameId);
              return (
                <li key={g.gameId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(g.gameId)}
                    className={`flex w-full items-center gap-2 rounded-xl p-1.5 text-left text-sm transition ${on ? "bg-accent/15 font-semibold" : "hover:bg-surface-2"}`}
                  >
                    {showCovers && <GameCover name={g.name} src={g.cover} size="xs" />}
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    {on && <Check className="size-4 text-accent" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="p-2 text-sm text-muted">{t("noMatch")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

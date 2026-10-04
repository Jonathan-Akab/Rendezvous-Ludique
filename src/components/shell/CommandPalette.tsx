"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarDays, CalendarPlus, Dices, LibraryBig, LoaderCircle, Search, Sparkles } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { GameCover } from "@/modules/games/components/GameCover";

type Results = {
  games: { id: string; name: string; year: number | null; cover: string | null }[];
  events: { id: string; title: string; startsAt: string; city: string | null }[];
  members: { username: string; displayName: string; meepleColor: string; city: string | null }[];
};
type Entry = { key: string; href: string; group: string; node: React.ReactNode };

/** ⌘K / Ctrl+K search across games, events, members and quick actions. */
export function CommandPalette({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("search");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQ("");
      setRes(null);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: Results) => {
          setRes(data);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 160);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const entries: Entry[] = useMemo(() => {
    if (!res) {
      return [
        { key: "a1", href: "/events/new", group: t("actions"), node: <><CalendarPlus className="size-4 text-accent" /> {t("announce")}</> },
        { key: "a2", href: "/plays/new", group: t("actions"), node: <><Dices className="size-4 text-accent" /> {t("logPlay")}</> },
        { key: "a3", href: "/kallax", group: t("actions"), node: <><LibraryBig className="size-4 text-accent" /> {t("kallax")}</> },
        { key: "a4", href: "/events?view=calendar", group: t("actions"), node: <><CalendarDays className="size-4 text-accent" /> {t("calendar")}</> },
        { key: "a5", href: "/ai", group: t("actions"), node: <><Sparkles className="size-4 text-accent" /> {t("ai")}</> },
      ];
    }
    return [
      ...res.games.map((g) => ({
        key: `g${g.id}`,
        href: `/games/${g.id}`,
        group: t("games"),
        node: (
          <>
            <GameCover name={g.name} src={g.cover} size="xs" />
            <span className="truncate">{g.name}</span>
            {g.year && <span className="text-xs text-muted">{g.year}</span>}
          </>
        ),
      })),
      ...res.events.map((e) => ({
        key: `e${e.id}`,
        href: `/events/${e.id}`,
        group: t("events"),
        node: (
          <>
            <CalendarDays className="size-4 text-accent" />
            <span className="truncate">{e.title}</span>
            <span className="ml-auto shrink-0 text-xs text-muted">
              {format.dateTime(new Date(e.startsAt), { dateStyle: "medium" })}
              {e.city && ` · ${e.city}`}
            </span>
          </>
        ),
      })),
      ...res.members.map((m) => ({
        key: `m${m.username}`,
        href: `/members/${m.username}`,
        group: t("members"),
        node: (
          <>
            <Meeple color={m.meepleColor} size={20} />
            <span className="truncate">{m.displayName}</span>
            <span className="text-xs text-muted">@{m.username}</span>
          </>
        ),
      })),
    ];
  }, [res, t, format]);

  const go = useCallback(
    (i: number) => {
      const e = entries[i];
      if (!e) return;
      setOpen(false);
      router.push(e.href);
    },
    [entries, router],
  );

  let lastGroup = "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-xl border border-line/70 bg-bg/60 px-3 py-2 text-sm text-muted transition hover:border-accent hover:text-ink ${
          compact ? "w-auto" : ""
        }`}
        title={t("open")}
      >
        <Search className="size-4 shrink-0" />
        <span className={`flex-1 text-left ${compact ? "hidden" : ""}`}>{t("placeholderShort")}</span>
        <kbd className={`rounded-md border border-line px-1.5 text-[10px] font-semibold ${compact ? "hidden" : ""}`}>⌘K</kbd>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setOpen(false)}>
            <motion.div
              className="glass w-full max-w-xl overflow-hidden rounded-3xl"
              initial={{ y: -20, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: -10, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={t("open")}
            >
              <div className="flex items-center gap-3 border-b border-line/60 px-4">
                {loading ? <LoaderCircle className="size-5 animate-spin text-muted" /> : <Search className="size-5 text-muted" />}
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((a) => Math.min(a + 1, entries.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((a) => Math.max(a - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      go(active);
                    }
                  }}
                  placeholder={t("placeholder")}
                  className="w-full bg-transparent py-4 text-base outline-none placeholder:text-muted"
                />
                <kbd className="rounded-md border border-line px-1.5 text-[10px] text-muted">ESC</kbd>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto p-2">
                {res && entries.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t("noResults")}</li>}
                {entries.map((e, i) => {
                  const header = e.group !== lastGroup ? e.group : null;
                  lastGroup = e.group;
                  return (
                    <li key={e.key}>
                      {header && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">{header}</p>}
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(i)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${i === active ? "bg-accent/15 text-ink" : ""}`}
                      >
                        {e.node}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

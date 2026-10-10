"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { ModuleIcon } from "@/components/icons";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/modules/notifications/actions";

type Item = { id: string; type: string; params: Record<string, string>; path: string; read: boolean; createdAt: string };

const ICONS: Record<string, string> = {
  friendRequest: "Users",
  playToConfirm: "Dices",
  eventJoinRequest: "CalendarDays",
  eventJoinAccepted: "CalendarDays",
  eventCancelled: "CalendarDays",
  kallaxInvite: "LibraryBig",
  bazaarMessage: "Store",
  suggestionUpdate: "Lightbulb",
};
const KNOWN = Object.keys(ICONS);

/** The bell in the top bar: unread count, and a list of one-line notifications that lead to the right place. */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: Item[] };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* offline: keep what we have */
    }
  }, []);

  // refresh now, every minute, and when the tab comes back into view
  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const go = (n: Item) => {
    setOpen(false);
    if (!n.read) {
      setItems((all) => all.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      start(() => markNotificationReadAction(n.id));
    }
    if (n.path.startsWith("/")) router.push(n.path);
  };
  const readAll = () => {
    setItems((all) => all.map((x) => ({ ...x, read: true })));
    setUnread(0);
    start(() => markAllNotificationsReadAction());
  };

  const sentence = t as unknown as (key: string, values?: Record<string, string>) => string;
  const now = new Date(); // relative times are measured from now
  const line = (n: Item) => sentence(KNOWN.includes(n.type) ? `items.${n.type}` : "items.other", n.params);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title={t("title")}
        aria-label={unread ? t("titleUnread", { count: unread }) : t("title")}
        className="relative grid size-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
      >
        <Bell className={`size-[18px] ${unread ? "text-accent" : ""}`} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass fixed right-2 top-[4.25rem] z-50 w-[min(92vw,26rem)] overflow-hidden rounded-2xl shadow-2xl sm:absolute sm:right-0 sm:top-full sm:mt-2"
          >
            <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5">
              <p className="flex-1 text-sm font-bold">{t("title")}</p>
              {unread > 0 && (
                <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  <CheckCheck className="size-3.5" /> {t("markAll")}
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">{t("empty")}</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto py-1">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2/70 ${n.read ? "" : "bg-accent/5"}`}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} aria-hidden />
                      <ModuleIcon name={ICONS[n.type] ?? "Sparkles"} className="size-4 shrink-0 text-accent" />
                      <span className={`min-w-0 flex-1 truncate text-sm ${n.read ? "text-muted" : "font-semibold"}`} title={line(n)}>
                        {line(n)}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">{format.relativeTime(new Date(n.createdAt), now)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

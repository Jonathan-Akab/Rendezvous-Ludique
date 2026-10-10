"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronRight, Megaphone, Pin, Sparkles, X } from "lucide-react";
import { animationsOn } from "@/components/AnimationToggle";
import { Meeple } from "@/components/Meeple";

const SEEN_KEY = "rl-board-seen";

type BannerItem = { at: string; preview: string; author: string; color: string; pinned: boolean };

/**
 * The message board on the home page, folded down to a compact card: up to three messages, pinned ones
 * first, each cut to a single line. A "New" badge (and a little show) stays until the board is opened;
 * clicking anywhere on the card opens the whole board in a popup.
 */
export function AnnouncementPopup({
  items,
  latestAt,
  total,
  emptyText,
  children,
}: {
  /** the messages shown on the card (at most three, pinned first) */
  items: BannerItem[];
  /** when the newest message of the whole board was posted, or null when it is empty */
  latestAt: string | null;
  total: number;
  /** what the card says when there is no message yet */
  emptyText: string;
  /** the full board (messages and the form for those who can post) */
  children: React.ReactNode;
}) {
  const t = useTranslations("announcements");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setSeenAt(localStorage.getItem(SEEN_KEY));
    } catch {
      /* storage unavailable: everything counts as new */
    }
  }, []);
  // the shake and twinkle follow the site's animation switch
  useEffect(() => {
    // moving effects: the site's animation switch, and never for people who asked their device for less motion
    const sync = () => setAnimated(animationsOn() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    sync();
    window.addEventListener("rl:animations", sync);
    return () => window.removeEventListener("rl:animations", sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // posted since the board was last opened (only known once the page is in the browser)
  const isNew = (at: string) => mounted && (!seenAt || at > seenAt);
  const unseen = Boolean(latestAt) && isNew(latestAt!);

  const openBoard = () => {
    setOpen(true);
    if (latestAt) {
      setSeenAt(latestAt);
      try {
        localStorage.setItem(SEEN_KEY, latestAt);
      } catch {
        /* storage unavailable */
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openBoard}
        aria-haspopup="dialog"
        className={`card-hover relative flex w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left ${unseen ? "board-bright border-accent/70" : "border-line/70"} ${unseen && animated ? "board-attention" : ""}`}
      >
        {unseen && animated && (
          <>
            <Sparkles className="board-twinkle pointer-events-none absolute -left-1.5 -top-2 size-4 text-accent" aria-hidden />
            <Sparkles className="board-twinkle pointer-events-none absolute -top-2.5 left-1/3 size-3 text-accent" style={{ animationDelay: "0.6s" }} aria-hidden />
            <Sparkles className="board-twinkle pointer-events-none absolute -right-1.5 -top-2 size-4 text-accent" style={{ animationDelay: "1.1s" }} aria-hidden />
            <Sparkles className="board-twinkle pointer-events-none absolute -bottom-2 right-1/4 size-3 text-accent" style={{ animationDelay: "0.3s" }} aria-hidden />
          </>
        )}
        <span className="relative flex shrink-0 items-center gap-2">
          <span className="relative">
            <Megaphone className="size-5 text-accent" aria-hidden />
            {unseen && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
          </span>
          <span className="hidden text-sm font-bold sm:inline">{t("title")}</span>
          {unseen && <span className="chip chip-accent px-2 py-0 text-[10px] font-bold uppercase">{t("newBadge")}</span>}
        </span>

        {items.length > 0 ? (
          <ul className="min-w-0 flex-1 space-y-0.5">
            {items.map((m, i) => (
              <li key={i} className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5">
                <span className={`size-1.5 shrink-0 rounded-full ${isNew(m.at) ? "bg-accent" : "bg-transparent"}`} aria-hidden />
                {m.pinned ? <Pin className="size-3 shrink-0 fill-current text-accent" aria-label={t("pinned")} /> : <Meeple color={m.color} size={14} />}
                <span className="shrink-0 font-semibold">{m.author}</span>
                <span className="truncate text-muted">{m.preview}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-muted">{emptyText}</span>
        )}

        {unseen && (
          // "Read me" in the site's language: it bounces slowly up and down inside the card (or just sits there when movement is off)
          <span className="relative -my-2 hidden min-h-8 w-24 shrink-0 self-stretch sm:block" aria-hidden>
            <span
              className={`chip chip-accent whitespace-nowrap px-2 py-0 text-[10px] font-bold shadow-[0_0_14px_var(--accent)] ${animated ? "board-bounce" : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}
            >
              {t("readMe")} ✦
            </span>
          </span>
        )}
        {total > items.length && <span className="chip shrink-0 px-2 py-0 text-[11px]">{t("more", { count: total - items.length })}</span>}
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={() => setOpen(false)}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="board-title"
                  className="glass max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 shadow-2xl"
                  initial={{ y: 40, scale: 0.97 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 40, scale: 0.97 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <h2 id="board-title" className="section-title flex flex-1 items-center gap-2">
                      <Megaphone className="size-5 text-accent" /> {t("title")}
                    </h2>
                    <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:text-ink" title={t("close")}>
                      <X className="size-5" />
                    </button>
                  </div>
                  {children}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

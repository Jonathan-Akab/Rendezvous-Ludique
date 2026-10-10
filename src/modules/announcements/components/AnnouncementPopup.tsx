"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronRight, Megaphone, Pin, Sparkles, X } from "lucide-react";
import { animationsOn } from "@/components/AnimationToggle";
import { Meeple } from "@/components/Meeple";

const SEEN_KEY = "rl-board-seen";

/**
 * The message board on the home page, folded down to one slim banner: the newest message
 * (cut short) with a "New" badge until it has been opened. Clicking it opens the whole board in a popup.
 */
export function AnnouncementPopup({
  latest,
  total,
  children,
}: {
  /** the newest message, or null when the board is empty */
  latest: { at: string; preview: string; author: string; color: string; pinned: boolean } | null;
  total: number;
  /** the full board (messages and the form for those who can post) */
  children: React.ReactNode;
}) {
  const t = useTranslations("announcements");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setUnseen(Boolean(latest) && localStorage.getItem(SEEN_KEY) !== latest!.at);
    } catch {
      setUnseen(Boolean(latest));
    }
  }, [latest]);
  // the shake and twinkle follow the site's animation switch
  useEffect(() => {
    const sync = () => setAnimated(animationsOn());
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

  const openBoard = () => {
    setOpen(true);
    if (latest) {
      setUnseen(false);
      try {
        localStorage.setItem(SEEN_KEY, latest.at);
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
        className={`card-hover relative flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left ${unseen ? "border-accent/60 bg-accent/10" : "border-line/70"} ${unseen && animated ? "board-attention" : ""}`}
      >
        {unseen && animated && (
          <>
            <Sparkles className="board-twinkle pointer-events-none absolute -left-1.5 -top-2 size-4 text-accent" aria-hidden />
            <Sparkles className="board-twinkle pointer-events-none absolute -top-2.5 left-1/3 size-3 text-accent" style={{ animationDelay: "0.6s" }} aria-hidden />
            <Sparkles className="board-twinkle pointer-events-none absolute -right-1.5 -top-2 size-4 text-accent" style={{ animationDelay: "1.1s" }} aria-hidden />
            <Sparkles className="board-twinkle pointer-events-none absolute -bottom-2 right-1/4 size-3 text-accent" style={{ animationDelay: "0.3s" }} aria-hidden />
          </>
        )}
        <span className="relative shrink-0">
          <Megaphone className="size-5 text-accent" aria-hidden />
          {unseen && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
        </span>
        <span className="hidden shrink-0 text-sm font-bold sm:inline">{t("title")}</span>
        {unseen && <span className="chip chip-accent shrink-0 px-2 py-0 text-[10px] font-bold uppercase">{t("newBadge")}</span>}
        {latest ? (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            {latest.pinned && <Pin className="size-3.5 shrink-0 fill-current text-accent" aria-label={t("pinned")} />}
            <Meeple color={latest.color} size={16} />
            <span className="shrink-0 font-semibold">{latest.author}</span>
            <span className="truncate text-muted">{latest.preview}</span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-muted">{t("empty")}</span>
        )}
        {total > 1 && <span className="chip shrink-0 px-2 py-0 text-[11px]">{t("more", { count: total - 1 })}</span>}
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

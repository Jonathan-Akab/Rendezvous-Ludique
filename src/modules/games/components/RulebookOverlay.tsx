"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { BookOpen, X } from "lucide-react";
import { RulebookReader } from "./RulebookReader";

// Rulebooks open in an overlay above the current page; closing it (✕, Escape, a click
// outside or the browser's Back button) returns exactly where the member was.

type Target = { fileId: string; page: number; title?: string };
const OPEN_EVENT = "rl:open-rulebook";

export function openRulebook(target: Target) {
  window.dispatchEvent(new CustomEvent<Target>(OPEN_EVENT, { detail: target }));
}

/** A link to a rulebook (optionally at a page) that opens the overlay. Ctrl/middle click still opens the full page. */
export function RulebookLink({
  fileId,
  page = 1,
  title,
  className,
  children,
  hint,
}: {
  fileId: string;
  page?: number;
  title?: string;
  className?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <a
      href={`/rulebooks/${fileId}${page > 1 ? `?page=${page}` : ""}`}
      title={hint}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openRulebook({ fileId, page, title });
      }}
    >
      {children}
    </a>
  );
}

/** Mounted once in the member layout. */
export function RulebookOverlay() {
  const t = useTranslations("games.reader");
  const [target, setTarget] = useState<Target | null>(null);
  const [mounted, setMounted] = useState(false);
  const pushed = useRef(false);

  const close = useCallback(() => {
    // Undo our history entry so Back doesn't reopen anything.
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
    setTarget(null);
  }, []);

  useEffect(() => {
    setMounted(true);
    const onOpen = (e: Event) => {
      setTarget((e as CustomEvent<Target>).detail);
      if (!pushed.current) {
        window.history.pushState({ ...window.history.state, rulebookOverlay: true }, "");
        pushed.current = true;
      }
    };
    // Browser Back closes the overlay instead of leaving the page.
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      setTarget(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind stays put
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [target, close]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={target.title ?? t("title")}
            className="flex w-full max-w-5xl flex-col gap-3 rounded-3xl bg-bg/95 p-3 shadow-2xl sm:p-4"
            initial={{ y: 30, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 30, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 px-1">
              <BookOpen className="size-5 shrink-0 text-accent" />
              <p className="min-w-0 flex-1 truncate font-display text-lg font-bold">{target.title ?? t("title")}</p>
              <button type="button" onClick={close} className="btn btn-secondary btn-sm" title={t("close")}>
                <X className="size-4" /> <span className="hidden sm:inline">{t("close")}</span>
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <RulebookReader key={`${target.fileId}-${target.page}`} fileId={target.fileId} initialPage={target.page} embedded />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

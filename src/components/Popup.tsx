"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

/** Small centered overlay: a card over a dimmed page. Esc / click outside closes it. */
export function Popup({
  open,
  onClose,
  title,
  icon,
  closeLabel,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  closeLabel: string;
  /** room for an embedded page */
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] grid place-items-center bg-black/55 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="popup-title"
        >
          <motion.div
            className={`card card-pad relative w-full space-y-4 shadow-2xl ${wide ? "max-w-[560px]" : "max-w-md"}`}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-muted hover:text-ink" title={closeLabel}>
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-3 pr-6">
              {icon && <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">{icon}</span>}
              <h2 id="popup-title" className="font-display text-lg font-bold leading-tight">
                {title}
              </h2>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Bullet list used in the popups. */
export function PopupBullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

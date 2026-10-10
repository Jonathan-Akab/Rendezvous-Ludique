"use client";

import { createPortal } from "react-dom";

/**
 * Invisible layer behind an open menu: the first tap anywhere else closes it. Phones and
 * tablets don't send "outside click" events when the tap lands on plain text or empty space,
 * so a listener alone can leave a menu stuck open. Sits just under the top bar (z-40).
 */
export function TapAway({ onClose }: { onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-[39]" onClick={onClose} aria-hidden />, document.body);
}

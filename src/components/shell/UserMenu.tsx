"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { TapAway } from "@/components/TapAway";
import { useTranslations } from "next-intl";
import { LogOut, Settings, ShieldCheck, ShieldHalf, UserRound } from "lucide-react";
import { MeepleAvatar } from "@/components/Meeple";
import { logoutAction } from "@/modules/auth/actions";

type Props = {
  user: { username: string; displayName: string; meepleColor: string };
  canModerate: boolean;
  canAdmin: boolean;
  /** "up" opens above the button (sidebar footer) */
  placement?: "up" | "down";
};

// Moderator/admin consoles are only reachable from here — a separate area, so the
// member experience stays the same for everyone.
export function UserMenu({ user, canModerate, canAdmin, placement = "down" }: Props) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // another page: the menu closes (taps on phones don't always reach the outside-click listener)
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-2xl p-1 pr-2 text-left transition hover:bg-surface-2 ${placement === "up" ? "w-full" : ""}`}
      >
        <MeepleAvatar color={user.meepleColor} size={36} />
        <span className={`min-w-0 ${placement === "up" ? "sidebar-label flex-1" : "hidden sm:block"}`}>
          <span className="block max-w-36 truncate text-sm font-semibold">{user.displayName}</span>
          {placement === "up" && <span className="block truncate text-xs text-muted">@{user.username}</span>}
        </span>
      </button>
      {open && <TapAway onClose={() => setOpen(false)} />}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: placement === "up" ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === "up" ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`glass absolute z-50 w-60 rounded-2xl p-2 ${placement === "up" ? "bottom-full left-0 mb-2" : "right-0 mt-2"}`}
            onClick={() => setOpen(false)}
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-bold">{user.displayName}</p>
              <p className="truncate text-xs text-muted">@{user.username}</p>
            </div>
            <Link href={`/members/${user.username}`} className={item} role="menuitem">
              <UserRound className="size-4" aria-hidden /> {t("myProfile")}
            </Link>
            <Link href="/settings" className={item} role="menuitem">
              <Settings className="size-4" aria-hidden /> {t("settings")}
            </Link>
            {(canModerate || canAdmin) && (
              <>
                <p className="mt-2 border-t border-line px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                  {t("specialAccess")}
                </p>
                {canModerate && (
                  <Link href="/moderation" className={item} role="menuitem">
                    <ShieldHalf className="size-4" aria-hidden /> {t("moderation")}
                  </Link>
                )}
                {canAdmin && (
                  <Link href="/admin" className={item} role="menuitem">
                    <ShieldCheck className="size-4" aria-hidden /> {t("adminConsole")}
                  </Link>
                )}
              </>
            )}
            <form action={logoutAction} className="mt-2 border-t border-line pt-2">
              <button type="submit" className={`${item} text-danger`} role="menuitem">
                <LogOut className="size-4" aria-hidden /> {t("logout")}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

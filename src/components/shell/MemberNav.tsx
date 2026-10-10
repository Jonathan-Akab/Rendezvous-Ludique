"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowDownUp, Check, Ellipsis, PanelLeftClose, PanelLeftOpen, RotateCcw, X } from "lucide-react";
import { ModuleIcon } from "@/components/icons";
import { Meeple } from "@/components/Meeple";
import { saveNavOrderAction } from "@/modules/preferences/actions";
import { openSuggestionBox } from "@/modules/suggestions/components/SuggestionDialog";
import { openDonate } from "@/modules/donations/components/DonatePopup";
import { MenuOrderEditor } from "./MenuOrderEditor";

/** A menu entry. `dialog` entries open a popup instead of navigating. */
export type NavItem = { href: string; label: string; icon: string; dialog?: "suggestions" | "donate" };

/** A menu link, or a button for entries that open a popup. */
function NavEntry({ item, onOpen, ...props }: { item: NavItem; onOpen?: () => void } & Omit<React.ComponentProps<"a">, "href">) {
  if (item.dialog) {
    const { className, title, children } = props;
    return (
      <button
        type="button"
        className={className}
        title={title}
        data-guide={(props as Record<string, unknown>)["data-guide"] as string | undefined}
        onClick={() => {
          onOpen?.();
          if (item.dialog === "donate") openDonate();
          else openSuggestionBox();
        }}
      >
        {children}
      </button>
    );
  }
  return <Link href={item.href} {...props} />;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_KEY = "rl-sidebar";

/** Desktop sidebar: the modules menu, collapsible to icons, reorderable by drag and drop. */
export function AppSidebar({ items, siteName, meepleColor }: { items: NavItem[]; siteName: string; meepleColor: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState(items);
  const [, start] = useTransition();

  useEffect(() => setOrder(items), [items]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "expanded";
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  const finish = () => {
    setEditing(false);
    start(() => saveNavOrderAction(order.map((i) => i.href)));
  };

  return (
    <aside className="app-sidebar glass fixed inset-y-3 left-3 z-40 hidden flex-col rounded-3xl p-3 lg:flex">
      <div className="flex items-center gap-2 px-2 pb-5 pt-2">
        <Link href="/home" className="group flex min-w-0 flex-1 items-center gap-2.5">
          <motion.span whileHover={{ rotate: -12, y: -2 }} className="shrink-0">
            <Meeple color={meepleColor} size={34} />
          </motion.span>
          <span className="sidebar-label line-clamp-2 font-display text-lg font-black leading-[1.05]">{siteName}</span>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          title={collapsed ? t("expand") : t("collapse")}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {editing ? (
        <div className="flex-1 overflow-y-auto" aria-label={t("reorder")}>
          <MenuOrderEditor items={order} onChange={setOrder} compact />
        </div>
      ) : (
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main" data-guide="menu">
          {order.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <NavEntry
                key={item.href}
                item={item}
                data-guide={`nav-${item.href.slice(1)}`}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "text-accent-ink" : "text-muted hover:bg-surface-2/70 hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-pill"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-accent to-[color-mix(in_oklab,var(--accent)_70%,var(--accent-2))] shadow-[0_8px_24px_-10px_var(--accent)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <ModuleIcon name={item.icon} className="relative size-5 shrink-0 transition group-hover:scale-110" />
                <span className="sidebar-label relative line-clamp-2 text-left leading-tight">{item.label}</span>
              </NavEntry>
            );
          })}
        </nav>
      )}

      <div className="mt-2 flex flex-col gap-1 border-t border-line/60 pt-2">
        {editing ? (
          <>
            <p className="sidebar-label px-2 pb-1 text-[11px] text-muted">{t("reorderHint")}</p>
            <button type="button" onClick={finish} className="btn btn-primary btn-sm w-full">
              <Check className="size-4" /> <span className="sidebar-label">{t("reorderDone")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                start(() => saveNavOrderAction([]));
              }}
              className="btn btn-ghost btn-sm w-full text-muted"
            >
              <RotateCcw className="size-3.5" /> <span className="sidebar-label">{t("reorderReset")}</span>
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary btn-sm w-full justify-start" title={t("reorder")}>
            <ArrowDownUp className="size-4" /> <span className="sidebar-label">{t("reorder")}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

/** Mobile bottom tab bar: four main items plus a "more" sheet. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const main = items.slice(0, 4);
  const more = items.slice(4);

  useEffect(() => setOpen(false), [pathname]);

  const tab = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <NavEntry
        key={item.href}
        item={item}
        aria-current={active ? "page" : undefined}
        className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-accent" : "text-muted"}`}
      >
        {active && <motion.span layoutId="mobile-dot" className="absolute top-0 h-1 w-8 rounded-full bg-accent" />}
        <ModuleIcon name={item.icon} className="size-5" />
        <span className="max-w-full truncate px-1">{item.label}</span>
      </NavEntry>
    );
  };

  return (
    <>
      <nav className="glass fixed inset-x-2 bottom-2 z-40 flex rounded-2xl px-1 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main">
        {main.map(tab)}
        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
              more.some((m) => isActive(pathname, m.href)) ? "text-accent" : "text-muted"
            }`}
          >
            <Ellipsis className="size-5" />
            {t("more")}
          </button>
        )}
      </nav>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.div
              className="glass fixed inset-x-2 bottom-2 z-50 rounded-3xl p-3 lg:hidden"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              exit={{ y: "110%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
            >
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted">
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => (
                  <NavEntry
                    key={item.href}
                    item={item}
                    onOpen={() => setOpen(false)}
                    className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-xs font-semibold ${
                      isActive(pathname, item.href) ? "bg-accent text-accent-ink" : "bg-surface-2/70"
                    }`}
                  >
                    <ModuleIcon name={item.icon} className="size-6" />
                    {item.label}
                  </NavEntry>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

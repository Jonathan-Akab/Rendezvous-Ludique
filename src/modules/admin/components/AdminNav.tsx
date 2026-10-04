"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Dices,
  Gauge,
  LibraryBig,
  Palette,
  Puzzle,
  ScrollText,
  Settings2,
  Sparkles,
  Store,
  Swords,
  Users2,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = { Gauge, Users, CalendarDays, Swords, LibraryBig, Dices, Puzzle, Palette, Settings2, ScrollText, Sparkles, Store, Users2 };

export type AdminNavItem = { href: string; label: string; icon: string; group: string };

export function AdminNav({ items, groups }: { items: AdminNavItem[]; groups: Record<string, string> }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5" aria-label="Admin">
      {Object.entries(groups).map(([key, label]) => (
        <div key={key}>
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-widest text-[var(--console-muted)]">{label}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.group === key)
              .map((i) => {
                const Icon = ICONS[i.icon] ?? Gauge;
                const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active ? "bg-accent text-accent-ink" : "text-[var(--console-ink)] hover:bg-white/10"
                      }`}
                    >
                      <Icon className="size-4" aria-hidden /> {i.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

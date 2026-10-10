"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, MapPin, Users2 } from "lucide-react";
import { FB_ROW, FB_TILE, TilePattern } from "./tile";

export type FbGroup = { id: string; name: string; url: string; description: string | null; region: string | null };

// Facebook doesn't let groups be embedded in other sites: a group's tile opens it on Facebook.
export function FacebookGroupTile({ group, variant = "tile" }: { group: FbGroup; variant?: "tile" | "row" }) {
  const t = useTranslations("facebook");
  if (variant === "row") {
    return (
      <a href={group.url} target="_blank" rel="noopener noreferrer" className={`${FB_ROW} border-[#0b2a5c] bg-[#14469c]`}>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#14469c]">
          <Users2 className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-black">{group.name}</span>
          <span className="block truncate text-xs text-white/80">{[group.region, group.description].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#14469c] sm:inline-flex">
          {t("openShort")} <ExternalLink className="size-3.5" />
        </span>
      </a>
    );
  }
  return (
    <a
      href={group.url}
      target="_blank"
      rel="noopener noreferrer"
      title={group.description ?? undefined}
      className={`${FB_TILE} border-[#0b2a5c] bg-[#14469c] shadow-[0_18px_40px_-18px_rgb(20_70_156/0.8),inset_0_2px_0_rgb(255_255_255/0.2)]`}
    >
      <TilePattern />
      <span className="relative grid size-12 shrink-0 rotate-[5deg] place-items-center rounded-2xl bg-white text-[#14469c] shadow-[0_6px_0_#b9c7e6] transition group-hover:rotate-[-5deg] group-hover:scale-105 sm:size-20">
        <Users2 className="size-6 sm:size-10" />
      </span>
      <span className="relative line-clamp-2 font-display text-sm font-black leading-snug sm:text-2xl sm:leading-tight">{group.name}</span>
      {group.region && (
        <span className="relative hidden items-center gap-1 text-xs text-white/80 sm:flex">
          <MapPin className="size-3" /> {group.region}
        </span>
      )}
      {group.description && <span className="relative hidden max-w-60 text-sm text-white/85 sm:line-clamp-2">{group.description}</span>}
      <span className="relative mt-1 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#14469c] shadow sm:text-sm">
        <span className="sm:hidden">{t("openShort")}</span>
        <span className="hidden sm:inline">{t("open")}</span> <ExternalLink className="size-3.5" />
      </span>
    </a>
  );
}

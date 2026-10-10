"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Users2 } from "lucide-react";
import { Popup } from "@/components/Popup";
import { FB_ROW, FB_TILE, TilePattern } from "./tile";

// A Facebook page promoted in "Groupes Facebook": a square game tile that opens the page itself
// (Facebook's official Page Plugin) in a popup, so members browse it without leaving the app.

export function FacebookPageTile({ url, name, variant = "tile" }: { url: string; name: string; variant?: "tile" | "row" }) {
  const t = useTranslations("facebook.featured");
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ w: 500, h: 640 });

  const show = () => {
    // the plugin draws itself at a fixed size (180–500 px wide): fit it to the screen
    setSize({ w: Math.max(180, Math.min(500, window.innerWidth - 72)), h: Math.max(320, Math.min(720, window.innerHeight - 230)) });
    setOpen(true);
  };
  const src = `https://www.facebook.com/plugins/page.php?${new URLSearchParams({
    href: url,
    tabs: "timeline,events",
    width: String(size.w),
    height: String(size.h),
    small_header: "false",
    adapt_container_width: "true",
    hide_cover: "false",
    show_facepile: "true",
  })}`;

  return (
    <>
      {variant === "row" ? (
        <button type="button" onClick={show} className={`${FB_ROW} border-[#0b3d91] bg-[#1877f2]`}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ffd43b] text-2xl">🐝</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-black">{name}</span>
            <span className="block truncate text-xs text-white/80">{t("kicker")}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#1877f2] sm:inline-flex">
            <Users2 className="size-3.5" /> {t("open")}
          </span>
        </button>
      ) : (
      <button type="button" onClick={show} className={`${FB_TILE} border-[#0b3d91] bg-[#1877f2] shadow-[0_18px_40px_-18px_rgb(24_119_242/0.8),inset_0_2px_0_rgb(255_255_255/0.25)]`}>
        <TilePattern />
        <span className="relative grid size-12 shrink-0 rotate-[-6deg] place-items-center rounded-2xl bg-[#ffd43b] text-2xl shadow-[0_6px_0_#e8a90c] transition group-hover:rotate-[6deg] group-hover:scale-105 sm:size-20 sm:text-5xl">
          🐝
        </span>
        <span className="relative hidden text-[11px] font-bold uppercase tracking-[0.18em] text-white/75 sm:block">{t("kicker")}</span>
        <span className="relative font-display text-xl font-black leading-tight sm:text-3xl">{name}</span>
        <span className="relative hidden max-w-60 text-sm text-white/85 sm:block">{t("lead")}</span>
        <span className="relative mt-1 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#1877f2] shadow sm:text-sm">
          <Users2 className="size-4" /> {t("open")}
        </span>
      </button>
      )}

      <Popup open={open} onClose={() => setOpen(false)} title={name} icon={<span className="text-xl">🐝</span>} closeLabel={t("close")} wide>
        <div className="overflow-hidden rounded-2xl bg-white" style={{ height: size.h }}>
          <iframe
            title={name}
            src={src}
            width={size.w}
            height={size.h}
            className="mx-auto block max-w-full border-0"
            scrolling="no"
            allow="encrypted-media; clipboard-write; web-share"
          />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-[#1877f2] px-6 py-2.5 text-white shadow-[0_10px_30px_-10px_#1877f2] hover:brightness-110"
          >
            <ExternalLink className="size-4" /> {t("onFacebook")}
          </a>
          <p className="text-xs text-muted">{t("blocked")}</p>
        </div>
      </Popup>
    </>
  );
}

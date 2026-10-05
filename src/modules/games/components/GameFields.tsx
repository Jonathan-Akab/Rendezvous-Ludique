"use client";

import { useTranslations } from "next-intl";
import { ImageUp } from "lucide-react";

export type GameFieldValues = {
  name?: string;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMin?: number | null;
  minAge?: number | null;
  weight?: number | null;
  designer?: string | null;
  publisher?: string | null;
  categories?: string | null;
  imageUrl?: string | null;
  description?: string | null;
};

/** Inputs describing a game in the shared catalogue. `prefix` namespaces field names. */
export function GameFields({
  values = {},
  prefix = "",
  showName = true,
  allowCover = true,
  compact = false,
}: {
  values?: GameFieldValues;
  prefix?: string;
  showName?: boolean;
  allowCover?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("games.fields");
  const n = (k: string) => `${prefix}${k}`;
  const num = (k: keyof GameFieldValues, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={n(k)}>
        {label}
      </label>
      <input id={n(k)} name={n(k)} type="number" defaultValue={(values[k] as number | null) ?? ""} className="input" {...extra} />
    </div>
  );
  const text = (k: keyof GameFieldValues, label: string, className = "", placeholder?: string) => (
    <div className={className}>
      <label className="label" htmlFor={n(k)}>
        {label}
      </label>
      <input id={n(k)} name={n(k)} defaultValue={(values[k] as string | null) ?? ""} className="input" placeholder={placeholder} />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {showName && (
        <div className="col-span-2 sm:col-span-4">
          <label className="label" htmlFor={n("name")}>
            {t("name")}
          </label>
          <input id={n("name")} name={n("name")} defaultValue={values.name ?? ""} className="input" required maxLength={150} />
        </div>
      )}
      {num("year", t("year"), { min: 1800, max: 2100 })}
      {num("minPlayers", t("minPlayers"), { min: 1, max: 100 })}
      {num("maxPlayers", t("maxPlayers"), { min: 1, max: 100 })}
      {num("playTimeMin", t("playTime"), { min: 1, max: 6000 })}
      {num("minAge", t("minAge"), { min: 1, max: 99 })}
      {!compact && num("weight", t("weight"), { min: 1, max: 5, step: 0.1 })}
      {text("designer", t("designer"), compact ? "col-span-2" : "")}
      {text("publisher", t("publisher"), compact ? "col-span-2" : "")}
      {!compact && text("categories", t("categories"), "col-span-2 sm:col-span-4", t("categoriesHint"))}
      {allowCover && (
        <div className="col-span-2">
          <label className="label" htmlFor={n("cover")}>
            {t("cover")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-bg px-3 py-2 text-sm text-muted hover:border-accent">
            <ImageUp className="size-4" />
            <input id={n("cover")} name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="w-full text-xs file:hidden" />
          </label>
        </div>
      )}
      {text("imageUrl", t("imageUrl"), "col-span-2", "https://…")}
      {!compact && (
        <div className="col-span-2 sm:col-span-4">
          <label className="label" htmlFor={n("description")}>
            {t("description")}
          </label>
          <textarea id={n("description")} name={n("description")} defaultValue={values.description ?? ""} className="textarea" />
        </div>
      )}
    </div>
  );
}

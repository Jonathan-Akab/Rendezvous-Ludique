"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { KALLAX_LANGUAGES } from "@/lib/constants";

/** "Language of my copy": private to the Kallax (not in the Ludothèque), and a filter when searching the Kallax. */
export function LanguageSelect({ defaultValue = "", name = "language", withHint = true }: { defaultValue?: string | null; name?: string; withHint?: boolean }) {
  const t = useTranslations("kallax.language");
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>
        {t("label")}
      </label>
      <select id={id} name={name} defaultValue={defaultValue ?? ""} className="select">
        <option value="">—</option>
        {KALLAX_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {t(`codes.${l}`)}
          </option>
        ))}
      </select>
      {withHint && <p className="mt-1 text-xs text-muted">{t("hint")}</p>}
    </div>
  );
}

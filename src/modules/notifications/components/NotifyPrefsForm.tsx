"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormMessage, SubmitButton } from "@/components/forms";
import { saveNotifyPrefsAction } from "../actions";

/** Checkboxes for each kind of email notification (opt-in). */
export function NotifyPrefsForm({ types, enabled }: { types: readonly string[]; enabled: string[] }) {
  const t = useTranslations("settings.notifications");
  const [state, action] = useActionState(saveNotifyPrefsAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((n) => (
          <label key={n} className="flex items-start gap-2 rounded-xl bg-surface-2/50 p-2 text-sm">
            <input type="checkbox" name="notify" value={n} defaultChecked={enabled.includes(n)} className="mt-0.5 size-4 accent-[var(--accent)]" />
            {t(`types.${n}`)}
          </label>
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary">{t("save")}</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { updateAnnouncementAction } from "../actions";

/** A board message, with a pencil that turns it into a form for staff. */
export function EditableAnnouncement({ id, body, children }: { id: string; body: string; children: ReactNode }) {
  const t = useTranslations("announcements");
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateAnnouncementAction.bind(null, id), undefined);
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <>
        {children}
        <button type="button" onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent">
          <Pencil className="size-3.5" /> {t("edit")}
        </button>
      </>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <textarea name="body" required maxLength={2000} rows={4} defaultValue={body} className="textarea" autoFocus />
      <FormMessage state={state?.ok ? undefined : state} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
          {t("cancel")}
        </button>
        <SubmitButton className="btn btn-primary btn-sm">{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

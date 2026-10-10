"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Megaphone, PenLine } from "lucide-react";
import { Popup } from "@/components/Popup";
import { FormMessage, SubmitButton } from "@/components/forms";
import { postAnnouncementAction } from "../actions";

/** The pen in the board's header: opens a small popup to post a message. */
export function NewAnnouncement() {
  const t = useTranslations("announcements");
  const [open, setOpen] = useState(false);
  // a fresh form each time the popup opens
  const [round, setRound] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
        title={t("new")}
        className="ml-auto grid size-8 place-items-center rounded-lg bg-accent/15 text-accent transition hover:bg-accent/25"
      >
        <PenLine className="size-4" />
        <span className="sr-only">{t("new")}</span>
      </button>
      <Popup open={open} onClose={() => setOpen(false)} title={t("new")} icon={<Megaphone className="size-5" />} closeLabel={t("cancel")}>
        <ComposeForm key={round} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Popup>
    </>
  );
}

function ComposeForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("announcements");
  const [state, action] = useActionState(postAnnouncementAction, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-3">
      <textarea name="body" required maxLength={2000} rows={5} className="textarea" placeholder={t("placeholder")} autoFocus />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pinned" className="size-4 accent-[var(--accent)]" /> {t("pinOnTop")}
      </label>
      <FormMessage state={state?.ok ? undefined : state} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          {t("cancel")}
        </button>
        <SubmitButton className="btn btn-primary btn-sm">{t("publish")}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Plus, UserPlus } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { addGameAction, inviteToLibraryAction } from "../actions";
import { GamePicker } from "@/modules/games/components/GamePicker";

type Member = { id: string; displayName: string };

export function AddGameForm({ libraryId, members }: { libraryId: string; members: Member[] }) {
  const t = useTranslations("kallax");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [state, action] = useActionState(addGameAction, undefined);

  useEffect(() => {
    if (state?.ok) setKey((k) => k + 1); // reset the picker after a successful add
  }, [state]);

  return (
    <div className="card p-4">
      <button type="button" className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className={`size-4 transition ${open ? "rotate-45" : ""}`} /> {t("addGame")}
      </button>
      {state?.ok && !open && <p className="mt-2 text-sm text-success">{state.message}</p>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key={key}
            action={action}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-visible"
          >
            <div className="space-y-4 pt-4">
              <input type="hidden" name="libraryId" value={libraryId} />
              <div>
                <span className="label">{t("form.name")}</span>
                <GamePicker />
                <p className="mt-1 text-xs text-muted">{t("form.pickerHint")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="kg-status">
                    {t("form.status")}
                  </label>
                  <select id="kg-status" name="status" className="select">
                    {LIBRARY_GAME_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="kg-owner">
                    {t("form.owner")}
                  </label>
                  <select id="kg-owner" name="ownerId" className="select">
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="kg-rating">
                    {t("form.rating")}
                  </label>
                  <select id="kg-rating" name="rating" className="select" defaultValue="">
                    <option value="">—</option>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}/10
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="kg-notes">
                  {t("form.notes")}
                </label>
                <input id="kg-notes" name="notes" className="input" maxLength={300} />
              </div>
              <FormMessage state={state} />
              <SubmitButton>{t("form.submit")}</SubmitButton>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
export function InviteForm({ libraryId }: { libraryId: string }) {
  const t = useTranslations("kallax");
  const [state, action] = useActionState(inviteToLibraryAction.bind(null, libraryId), undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="username" className="input" placeholder={t("sharing.usernamePlaceholder")} required />
        <SubmitButton className="btn btn-secondary shrink-0">
          <UserPlus className="size-4" /> {t("sharing.invite")}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

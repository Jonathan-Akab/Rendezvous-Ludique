"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Camera, ClipboardList, Images, PencilLine, Plus, Search, UserPlus } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { addGameAction, inviteToLibraryAction } from "../actions";
import { GamePicker } from "@/modules/games/components/GamePicker";
import { GameFields } from "@/modules/games/components/GameFields";
import { EnrichProgress } from "@/modules/games/components/EnrichProgress";
import { ImportWizard, type ImportSource, type PhotoAi } from "./ImportWizard";
import type { KallaxBase } from "./ImportReview";

type Member = { id: string; displayName: string };
type AddMethod = "manual" | "search" | ImportSource;

/**
 * "Add a game": the member picks how — typing the details (default), searching the
 * Ludothèque, or importing several at once (box photo, shelf photo, a list).
 */
export function AddGameForm({
  libraryId,
  members,
  libraries,
  ai,
  enrich,
  bases,
}: {
  libraryId: string;
  members: Member[];
  libraries: { id: string; name: string }[];
  ai: PhotoAi;
  /** the free AI completes added games (details + picture) */
  enrich: boolean;
  /** base games already in the member's Kallax (an added expansion can be attached to one) */
  bases: KallaxBase[];
}) {
  const t = useTranslations("kallax");
  const ti = useTranslations("kallax.import");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [mode, setMode] = useState<AddMethod>("manual");
  const [state, action] = useActionState(addGameAction, undefined);

  useEffect(() => {
    if (state?.ok) setKey((k) => k + 1); // reset the form after a successful add
  }, [state]);

  const methods: { key: AddMethod; icon: typeof Plus; label: string; available: boolean; hint?: string }[] = [
    { key: "manual", icon: PencilLine, label: t("form.modes.manual"), available: true },
    { key: "search", icon: Search, label: t("form.modes.search"), available: true },
    { key: "box", icon: Camera, label: ti("sources.box.title"), available: ai.anyAvailable, hint: ti("sources.box.unavailable") },
    { key: "shelf", icon: Images, label: ti("sources.shelf.title"), available: ai.anyAvailable, hint: ti("sources.shelf.unavailable") },
    { key: "list", icon: ClipboardList, label: ti("sources.list.title"), available: true },
  ];
  const single = mode === "manual" || mode === "search";

  return (
    <div className="card p-4">
      <button type="button" className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className={`size-4 transition ${open ? "rotate-45" : ""}`} /> {t("addGame")}
      </button>
      {state?.ok && !open && <p className="mt-2 text-sm text-success">{state.message}</p>}
      {state?.ok && Boolean(state.data?.kallaxGameId) && (
        <div className="mt-4">
          <EnrichProgress
            key={String(state.data!.kallaxGameId)}
            games={[{ id: String(state.data!.kallaxGameId), name: String(state.data!.name) }]}
            needPicture={state.data!.needsImage ? [{ id: String(state.data!.kallaxGameId), name: String(state.data!.name) }] : []}
            enabled={enrich}
          />
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-visible">
            <div className="space-y-4 pt-4">
              <div>
                <p className="label">{t("form.how")}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {methods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      disabled={!m.available}
                      title={m.available ? undefined : m.hint}
                      onClick={() => setMode(m.key)}
                      aria-pressed={mode === m.key}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        mode === m.key ? "border-accent bg-accent/10 text-accent" : "border-line/70 text-muted hover:border-accent/50 hover:text-ink"
                      }`}
                    >
                      <m.icon className="size-4 shrink-0" /> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {single ? (
                <form key={key} action={action} className="space-y-4">
                  <input type="hidden" name="libraryId" value={libraryId} />
                  {mode === "manual" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted">{t("form.manualHint")}</p>
                      <GameFields compact />
                    </div>
                  ) : (
                    <div>
                      <span className="label">{t("form.name")}</span>
                      <GamePicker />
                      <p className="mt-1 text-xs text-muted">{t("form.pickerHint")}</p>
                    </div>
                  )}
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="kg-parent">
                        {t("form.expansionOf")}
                      </label>
                      <select id="kg-parent" name="parentId" className="select" defaultValue="">
                        <option value="">{t("form.notExpansion")}</option>
                        {bases
                          .filter((b) => b.libraryId === libraryId)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="kg-notes">
                        {t("form.notes")}
                      </label>
                      <input id="kg-notes" name="notes" className="input" maxLength={300} />
                    </div>
                  </div>
                  <FormMessage state={state} />
                  <SubmitButton>{t("form.submit")}</SubmitButton>
                </form>
              ) : (
                <ImportWizard
                  key={mode}
                  source={mode}
                  libraries={libraries}
                  defaultLibraryId={libraryId}
                  ai={ai}
                  enrich={enrich}
                  bases={bases}
                />
              )}
            </div>
          </motion.div>
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

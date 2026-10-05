"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { House, PartyPopper, Swords, Tent } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { LocationFields } from "@/components/LocationFields";
import type { ActionState } from "@/lib/forms";
import { MyGameSelect, type MyGameOption } from "@/modules/kallax/components/MyGameSelect";

export type EventFormValues = {
  title?: string;
  description?: string | null;
  kind?: string;
  startsAt?: string;
  endsAt?: string;
  locationName?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visibility?: string;
  maxPlayers?: number | null;
  requiresApproval?: boolean;
  gameIds?: string[];
};

const KINDS = [
  { key: "HOME_GAME", icon: House },
  { key: "GAME_NIGHT", icon: PartyPopper },
  { key: "TOURNAMENT", icon: Swords },
  { key: "CONVENTION", icon: Tent },
] as const;

export function EventForm({
  action,
  values = {},
  allowHomeGames,
  allowPublic,
  submitLabel,
  returnTo,
  myGames,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  values?: EventFormValues;
  allowHomeGames: boolean;
  allowPublic: boolean;
  submitLabel: string;
  returnTo?: "admin";
  /** games from the host's Kallax, to put on the menu */
  myGames: MyGameOption[];
}) {
  const t = useTranslations("events");
  const [state, formAction] = useActionState(action, undefined);
  const [kind, setKind] = useState(values.kind ?? (allowHomeGames ? "HOME_GAME" : "GAME_NIGHT"));

  return (
    <form action={formAction} className="space-y-6">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <fieldset>
        <legend className="label">{t("form.kind")}</legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.filter((k) => allowHomeGames || k.key !== "HOME_GAME").map((k) => (
            <button
              type="button"
              key={k.key}
              onClick={() => setKind(k.key)}
              aria-pressed={kind === k.key}
              className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                kind === k.key ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
              }`}
            >
              {kind === k.key && (
                <motion.span layoutId="kind-pill" className="absolute inset-0 rounded-xl bg-accent/10" />
              )}
              <k.icon className="relative size-5" aria-hidden />
              <span className="relative">{t(`kinds.${k.key}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="title">
          {t("form.title")}
        </label>
        <input id="title" name="title" className="input" required maxLength={120} defaultValue={values.title} placeholder={t("form.titlePlaceholder")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startsAt">
            {t("form.startsAt")}
          </label>
          <input id="startsAt" name="startsAt" type="datetime-local" className="input" required defaultValue={values.startsAt} />
        </div>
        <div>
          <label className="label" htmlFor="endsAt">
            {t("form.endsAt")}
          </label>
          <input id="endsAt" name="endsAt" type="datetime-local" className="input" defaultValue={values.endsAt} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">
          {t("form.description")}
        </label>
        <textarea id="description" name="description" className="textarea" rows={4} defaultValue={values.description ?? ""} placeholder={t("form.descriptionPlaceholder")} />
      </div>

      <div>
        <span className="label">{t("form.games")}</span>
        <MyGameSelect games={myGames} name="gameIds" multiple defaultValue={values.gameIds} />
      </div>

      <div className="card space-y-4 bg-surface-2/50 p-4">
        <p className="section-title text-base">{t("form.where")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="locationName">
              {t("form.locationName")}
            </label>
            <input id="locationName" name="locationName" className="input" defaultValue={values.locationName ?? ""} placeholder={kind === "HOME_GAME" ? t("form.locationHome") : t("form.locationVenue")} />
          </div>
          <div>
            <label className="label" htmlFor="city">
              {t("form.city")}
            </label>
            <input id="city" name="city" className="input" defaultValue={values.city ?? ""} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="address">
            {t("form.address")}
          </label>
          <input id="address" name="address" className="input" defaultValue={values.address ?? ""} />
          {kind === "HOME_GAME" && <p className="mt-1 text-xs text-muted">{t("form.addressPrivate")}</p>}
        </div>
        <LocationFields latitude={values.latitude} longitude={values.longitude} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="visibility">
            {t("form.visibility")}
          </label>
          <select id="visibility" name="visibility" className="select" defaultValue={values.visibility ?? "MEMBERS"}>
            {allowPublic && <option value="PUBLIC">{t("visibility.PUBLIC")}</option>}
            <option value="MEMBERS">{t("visibility.MEMBERS")}</option>
            <option value="FRIENDS">{t("visibility.FRIENDS")}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="maxPlayers">
            {t("form.maxPlayers")}
          </label>
          <input id="maxPlayers" name="maxPlayers" type="number" min={2} className="input" defaultValue={values.maxPlayers ?? ""} placeholder={t("form.maxPlayersHint")} />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="requiresApproval" defaultChecked={values.requiresApproval ?? kind === "HOME_GAME"} className="mt-1 size-4 accent-[var(--accent)]" />
        <span>
          <span className="font-semibold">{t("form.requiresApproval")}</span>
          <span className="block text-muted">{t("form.requiresApprovalHint")}</span>
        </span>
      </label>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full py-3 sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}

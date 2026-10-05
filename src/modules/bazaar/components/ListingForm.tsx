"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { LocationFields } from "@/components/LocationFields";
import { MyGameSelect, type MyGameOption } from "@/modules/kallax/components/MyGameSelect";
import type { ActionState } from "@/lib/forms";

export type ListingValues = {
  title?: string;
  description?: string | null;
  price?: number | null;
  kind?: string;
  condition?: string;
  delivery?: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: { id: string; fileId: string }[];
};

const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"];

export function ListingForm({
  action,
  values = {},
  game,
  myGames,
  editing = false,
  allowTrades,
  currency,
  maxPhotos,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  values?: ListingValues;
  /** game id pre-selected (selling from a Kallax game) */
  game?: string | null;
  myGames: MyGameOption[];
  editing?: boolean;
  allowTrades: boolean;
  currency: string;
  maxPhotos: number;
}) {
  const t = useTranslations("bazaar");
  const [state, formAction] = useActionState(action, undefined);
  const [kind, setKind] = useState(values.kind ?? "SALE");
  const [previews, setPreviews] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const existing = (values.photos ?? []).filter((p) => !removed.includes(p.id));
  const room = Math.max(0, maxPhotos - existing.length);

  return (
    <form action={formAction} className="space-y-6">
      {!editing && (
        <div>
          <span className="label">{t("form.game")}</span>
          <MyGameSelect games={myGames} defaultValue={game ?? undefined} required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="title">
          {t("form.title")}
        </label>
        <input id="title" name="title" defaultValue={values.title} className="input" maxLength={120} placeholder={t("form.titlePlaceholder")} />
      </div>

      {allowTrades && (
        <fieldset>
          <legend className="label">{t("form.kind")}</legend>
          <div className="grid grid-cols-3 gap-2">
            {["SALE", "TRADE", "BOTH"].map((k) => (
              <label key={k} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold transition ${kind === k ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"}`}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {t(`kinds.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {!allowTrades && <input type="hidden" name="kind" value="SALE" />}

      <div className="grid gap-4 sm:grid-cols-3">
        {kind !== "TRADE" && (
          <div>
            <label className="label" htmlFor="price">
              {t("form.price", { currency })}
            </label>
            <input id="price" name="price" type="number" min={0} step="0.01" defaultValue={values.price ?? ""} className="input" required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="condition">
            {t("form.condition")}
          </label>
          <select id="condition" name="condition" defaultValue={values.condition ?? "GOOD"} className="select">
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`conditions.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="delivery">
            {t("form.delivery")}
          </label>
          <select id="delivery" name="delivery" defaultValue={values.delivery ?? "PICKUP"} className="select">
            {["PICKUP", "SHIPPING", "BOTH"].map((d) => (
              <option key={d} value={d}>
                {t(`delivery.${d}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">
          {t("form.description")}
        </label>
        <textarea id="description" name="description" defaultValue={values.description ?? ""} className="textarea" maxLength={3000} placeholder={t("form.descriptionPlaceholder")} />
      </div>

      <div>
        <span className="label">{t("form.photos", { max: maxPhotos })}</span>
        <div className="flex flex-wrap gap-2">
          {existing.map((p) => (
            <div key={p.id} className="relative size-24 overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/files/${p.fileId}`} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setRemoved((r) => [...r, p.id])} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" title={t("form.removePhoto")}>
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {removed.map((id) => (
            <input key={id} type="hidden" name="removePhoto" value={id} />
          ))}
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="size-24 rounded-xl border border-accent/60 object-cover" />
          ))}
          {room > 0 && (
            <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent">
              <ImagePlus className="size-6" />
              <input
                name="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="sr-only"
                onChange={(e) => setPreviews(Array.from(e.target.files ?? []).slice(0, room).map((f) => URL.createObjectURL(f)))}
              />
            </label>
          )}
        </div>
      </div>

      <div className="card space-y-3 bg-surface-2/40 p-4">
        <div>
          <label className="label" htmlFor="city">
            {t("form.city")}
          </label>
          <input id="city" name="city" defaultValue={values.city ?? ""} className="input" />
        </div>
        <LocationFields latitude={values.latitude} longitude={values.longitude} />
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full py-3 sm:w-auto">{editing ? t("form.save") : t("form.publish")}</SubmitButton>
    </form>
  );
}

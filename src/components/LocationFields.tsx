"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, LocateFixed, LoaderCircle } from "lucide-react";

/** Hidden latitude/longitude inputs filled from the browser's geolocation. */
export function LocationFields({ latitude, longitude }: { latitude?: number | null; longitude?: number | null }) {
  const t = useTranslations("location");
  const [coords, setCoords] = useState(latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const locate = () => {
    if (!navigator.geolocation) return setState("error");
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // ~1 km precision is plenty for "games near me" and protects privacy
        setCoords({ lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2) });
        setState("idle");
      },
      () => setState("error"),
      { timeout: 10000 },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={locate} disabled={state === "loading"}>
        {state === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
        {coords ? t("update") : t("useMine")}
      </button>
      {coords && (
        <>
          <span className="chip">
            <Check className="size-3 text-success" /> {t("set")}
          </span>
          <button type="button" className="text-xs text-muted underline" onClick={() => setCoords(null)}>
            {t("clear")}
          </button>
        </>
      )}
      {state === "error" && <span className="text-xs text-danger">{t("error")}</span>}
      <p className="w-full text-xs text-muted">{t("hint")}</p>
    </div>
  );
}

/** Button that adds the visitor's position to the current URL (for "near me" searches). */
export function NearMeButton({ active }: { active: boolean }) {
  const t = useTranslations("location");
  const [loading, setLoading] = useState(false);

  const go = () => {
    const url = new URL(window.location.href);
    if (active) {
      url.searchParams.delete("lat");
      url.searchParams.delete("lng");
      window.location.assign(url);
      return;
    }
    setLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        url.searchParams.set("lat", pos.coords.latitude.toFixed(2));
        url.searchParams.set("lng", pos.coords.longitude.toFixed(2));
        window.location.assign(url);
      },
      () => setLoading(false),
      { timeout: 10000 },
    );
  };

  return (
    <button type="button" onClick={go} className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}>
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
      {active ? t("nearMeOn") : t("nearMe")}
    </button>
  );
}

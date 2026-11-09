"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Hourglass, Lock, MapPin, Unlock, UserPlus } from "lucide-react";

/**
 * The address and "join" part of a demo event: hidden address, then what happens when the
 * visitor asks — the host approves by hand (request pending) or automatically (seat
 * confirmed, address revealed). Nothing is saved.
 */
export function DemoJoinButton({ label, approval, address }: { label: string; approval: boolean; address: string | null }) {
  const t = useTranslations("demo.join");
  const [clicked, setClicked] = useState(false);
  const revealed = clicked && !approval;
  return (
    <div className="space-y-3">
      {address && (
        <div data-guide="demo-address" className={`space-y-1.5 rounded-2xl border p-3 text-sm ${revealed ? "border-success/50 bg-success/10" : "border-line/70 bg-surface-2/60"}`}>
          <p className="flex items-center gap-2 font-semibold">
            {revealed ? <Unlock className="size-4 text-success" /> : <Lock className="size-4 text-accent" />}
            {revealed ? t("addressShown") : t("addressHidden")}
          </p>
          {revealed ? (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 font-bold">
              <MapPin className="size-4 text-success" /> {address}
            </motion.p>
          ) : (
            <p className="select-none font-bold tracking-widest text-muted blur-[3px]" aria-hidden>
              ███, ████ ███ ███████
            </p>
          )}
          <p className="text-xs text-muted">{approval ? t("manual") : t("auto")}</p>
        </div>
      )}
      {clicked ? (
        <div className={`space-y-2 rounded-2xl p-3 text-sm ${approval ? "bg-accent/10" : "bg-success/10"}`}>
          <p className={`flex items-center gap-2 font-semibold ${approval ? "text-accent" : "text-success"}`}>
            {approval ? <Hourglass className="size-4" /> : <Unlock className="size-4" />} {approval ? t("pending") : t("confirmed")}
          </p>
          <p className="text-xs text-muted">{t("demoNote")}</p>
          <Link href="/register" className="btn btn-primary btn-sm">
            <UserPlus className="size-4" /> {t("signUp")}
          </Link>
        </div>
      ) : (
        <button type="button" onClick={() => setClicked(true)} className="btn btn-primary">
          {label}
        </button>
      )}
    </div>
  );
}

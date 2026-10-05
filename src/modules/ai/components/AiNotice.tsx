"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HeartHandshake, Sparkles } from "lucide-react";
import { Popup, PopupBullets } from "@/components/Popup";
import { openDonate } from "@/modules/donations/components/DonatePopup";
import { aiNoticeTickAction } from "../actions";

// How the rules AI is paid for: shown on the first visit, then every 30th (hidden counter on the member).

export function AiNotice({ ownAllowed, donate }: { ownAllowed: boolean; donate: boolean }) {
  const t = useTranslations("ai.notice");
  const [open, setOpen] = useState(false);
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current) return; // StrictMode runs effects twice in dev
    counted.current = true;
    void aiNoticeTickAction().then((due) => due && setOpen(true));
  }, []);

  const close = () => setOpen(false);
  return (
    <Popup open={open} onClose={close} title={t("title")} icon={<Sparkles className="size-5" />} closeLabel={t("ok")}>
      <PopupBullets
        items={[
          t("b1"),
          t("b2"),
          ownAllowed ? (
            <>
              {t("b3own")}{" "}
              <Link href="/settings#own-key" onClick={close} className="font-semibold text-accent hover:underline">
                {t("ownLink")}
              </Link>
            </>
          ) : (
            t("b3")
          ),
          ...(donate ? [t("b4")] : []),
        ]}
      />
      <div className="flex justify-end gap-2">
        {donate && (
          <button
            type="button"
            onClick={() => {
              close();
              openDonate();
            }}
            className="btn btn-ghost btn-sm"
          >
            <HeartHandshake className="size-4" aria-hidden />
            {t("donate")}
          </button>
        )}
        <button type="button" onClick={close} className="btn btn-primary btn-sm" autoFocus>
          {t("ok")}
        </button>
      </div>
    </Popup>
  );
}

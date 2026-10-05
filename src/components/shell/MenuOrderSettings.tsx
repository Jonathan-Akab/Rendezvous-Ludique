"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, RotateCcw } from "lucide-react";
import { saveNavOrderAction } from "@/modules/preferences/actions";
import { MenuOrderEditor } from "./MenuOrderEditor";
import type { NavItem } from "./MemberNav";

/** "Menu order" section of the settings page (handy on phones, where there's no sidebar). */
export function MenuOrderSettings({ items }: { items: NavItem[] }) {
  const t = useTranslations("nav");
  const [order, setOrder] = useState(items);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = (hrefs: string[]) =>
    start(async () => {
      await saveNavOrderAction(hrefs);
      setSaved(true);
    });

  return (
    <div className="space-y-3">
      <MenuOrderEditor
        items={order}
        onChange={(next) => {
          setOrder(next);
          setSaved(false);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => save(order.map((i) => i.href))}>
          <Check className="size-4" /> {t("saveOrder")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm text-muted" disabled={pending} onClick={() => save([])}>
          <RotateCcw className="size-3.5" /> {t("reorderReset")}
        </button>
        {saved && <span className="text-sm text-success">{t("orderSaved")}</span>}
      </div>
    </div>
  );
}

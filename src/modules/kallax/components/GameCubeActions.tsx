"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Store, Trash2 } from "lucide-react";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { removeLibraryGameAction, setLibraryGameStatusAction } from "../actions";

export function GameCubeActions({ id, status, name, sellHref }: { id: string; status: string; name: string; sellHref?: string }) {
  const t = useTranslations("kallax");
  const [pending, start] = useTransition();
  return (
    <div className={`flex items-center gap-1 ${pending ? "opacity-50" : ""}`}>
      <select
        aria-label={t("form.status")}
        className="w-full rounded-md border border-line bg-surface px-1 py-0.5 text-[11px]"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => start(() => setLibraryGameStatusAction(id, e.target.value))}
      >
        {LIBRARY_GAME_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
      {sellHref && (
        <Link href={sellHref} title={t("sell")} className="rounded-md p-1 text-muted hover:bg-accent/10 hover:text-accent">
          <Store className="size-3.5" />
        </Link>
      )}
      <button
        type="button"
        title={t("remove")}
        disabled={pending}
        className="rounded-md p-1 text-muted hover:bg-danger/10 hover:text-danger"
        onClick={() => confirm(t("removeConfirm", { name })) && start(() => removeLibraryGameAction(id))}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

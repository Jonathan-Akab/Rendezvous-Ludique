"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileUp, LibraryBig, Search } from "lucide-react";
import { MyGameSelect, type MyGameOption } from "@/modules/kallax/components/MyGameSelect";
import { GamePicker } from "@/modules/games/components/GamePicker";
import { ActionForm } from "@/components/ActionForm";
import { uploadRulebookByNameAction } from "@/modules/games/actions";

type Source = "kallax" | "ludo" | "upload";

/**
 * Choose the game to ask about: from your Kallax, from the whole Ludothèque, or by
 * uploading a rulebook (which reuses or creates the Ludothèque entry).
 */
export function AiGameSelect({ games, canUpload }: { games: MyGameOption[]; canUpload: boolean }) {
  const t = useTranslations("ai.source");
  const router = useRouter();
  const [source, setSource] = useState<Source>("kallax");
  const go = (id?: string) => id && router.push(`/ai?game=${id}`);

  const tabs: { id: Source; label: string; icon: typeof Search }[] = [
    { id: "kallax", label: t("kallax"), icon: LibraryBig },
    { id: "ludo", label: t("ludo"), icon: Search },
    ...(canUpload ? [{ id: "upload" as const, label: t("upload"), icon: FileUp }] : []),
  ];

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={source === id}
            onClick={() => setSource(id)}
            className={`btn btn-sm ${source === id ? "btn-primary" : "btn-secondary"}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {source === "kallax" && (
        <>
          <MyGameSelect games={games} onChange={(ids) => go(ids[0])} />
          <p className="text-xs text-muted">{t("kallaxHint")}</p>
        </>
      )}

      {source === "ludo" && (
        <>
          <GamePicker allowCreate={false} onPick={(g) => go(g?.id)} />
          <p className="text-xs text-muted">{t("ludoHint")}</p>
        </>
      )}

      {source === "upload" && canUpload && (
        <ActionForm action={uploadRulebookByNameAction} submitLabel={t("uploadSubmit")} className="space-y-3">
          <input name="name" className="input" placeholder={t("gameName")} maxLength={150} required />
          <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
            <input name="title" className="input" placeholder={t("rulebookTitle")} maxLength={120} />
            <select name="language" className="select" defaultValue="fr">
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <input name="file" type="file" accept="application/pdf" required className="input" />
          <p className="text-xs text-muted">{t("uploadHint")}</p>
        </ActionForm>
      )}
    </div>
  );
}

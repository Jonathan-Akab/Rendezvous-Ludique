"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileUp, LibraryBig, Search } from "lucide-react";
import type { MyGameOption } from "@/modules/kallax/components/MyGameSelect";
import { GamePicker } from "@/modules/games/components/GamePicker";
import { ActionForm } from "@/components/ActionForm";
import { uploadRulebookByNameAction } from "@/modules/games/actions";

type Source = "kallax" | "ludo" | "upload";

/**
 * Choose the game to ask about: from your Kallax, from the whole Ludothèque, or by
 * uploading a rulebook (which reuses or creates the Ludothèque entry).
 */
export function AiGameSelect({
  games,
  canUpload,
  hrefBase = "/ai?game=",
  initialSource = "kallax",
  syncUrl = false,
}: {
  games: MyGameOption[];
  canUpload: boolean;
  /** where a picked game leads: this prefix + the game id */
  hrefBase?: string;
  initialSource?: Source;
  /** keep the chosen tab in the page address (?src=), so the page can list the matching games */
  syncUrl?: boolean;
}) {
  const t = useTranslations("ai.source");
  const router = useRouter();
  const [source, setSource] = useState<Source>(initialSource);
  const choose = (id: Source) => {
    setSource(id);
    if (syncUrl) {
      const params = new URLSearchParams(window.location.search);
      params.set("src", id);
      router.replace(`?${params}`, { scroll: false });
    }
  };
  const go = (id?: string) => id && router.push(`${hrefBase}${id}`);

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
            onClick={() => choose(id)}
            className={`btn btn-sm ${source === id ? "btn-primary" : "btn-secondary"}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {source === "kallax" && (
        <>
          <KallaxSearch games={games} onPick={go} />
          <p className="text-xs text-muted">{t("kallaxHint")}</p>
        </>
      )}

      {source === "ludo" && (
        <>
          <GamePicker allowCreate={false} showCovers={false} onPick={(g) => go(g?.id)} />
          <p className="text-xs text-muted">{t("ludoHint")}</p>
        </>
      )}

      {source === "upload" && canUpload && (
        <ActionForm action={uploadRulebookByNameAction} submitLabel={t("uploadSubmit")} className="space-y-3">
          <input name="name" className="input" placeholder={t("gameName")} maxLength={150} required />
          <select name="language" className="select" defaultValue="fr" aria-label={t("language")}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          <input name="file" type="file" accept="application/pdf" required className="input" />
          <p className="text-xs text-muted">{t("uploadHint")}</p>
        </ActionForm>
      )}
    </div>
  );
}

/** A search box over your own Kallax: nothing is listed until you type. */
function KallaxSearch({ games, onPick }: { games: MyGameOption[]; onPick: (id: string) => void }) {
  const t = useTranslations("kallax.pick");
  const [q, setQ] = useState("");
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const needle = norm(q.trim());
  const results = needle ? games.filter((g) => norm(g.name).includes(needle)).slice(0, 8) : [];
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) onPick(results[0].gameId);
          }
        }}
        placeholder={t("search")}
        aria-label={t("search")}
        autoComplete="off"
        className="input py-3 pl-9 text-base"
      />
      {needle && (
        <ul role="listbox" className="glass absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl p-1.5">
          {results.map((g) => (
            <li key={g.gameId} role="option" aria-selected={false}>
              <button type="button" onClick={() => onPick(g.gameId)} className="w-full truncate rounded-xl p-2 text-left text-sm font-semibold hover:bg-accent/15">
                {g.name}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="p-2 text-sm text-muted">{t("noMatch")}</li>}
        </ul>
      )}
    </div>
  );
}

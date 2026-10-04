import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader, SearchBar } from "@/modules/admin/components/AdminUi";
import { GameFields } from "@/modules/games/components/GameFields";
import { GameCover } from "@/modules/games/components/GameCover";
import { coverUrl } from "@/modules/games/service";
import { deleteGameAction, mergeGameAction, saveGameAction } from "@/modules/admin/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("games") };
}

export default async function AdminGamesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [sp, t] = await Promise.all([searchParams, getTranslations("admin.games")]);
  const [games, all] = await Promise.all([
    db.game.findMany({
      where: sp.q ? { name: ilike(sp.q) } : {},
      include: { _count: { select: { libraryGames: true, plays: true, eventGames: true } } },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.game.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} lead={t("lead", { count: all.length })} />
      <details className="card card-pad">
        <summary className="cursor-pointer font-semibold">{t("add")}</summary>
        <div className="mt-4">
          <ActionForm action={saveGameAction.bind(null, null)} submitLabel={t("create")}>
            <GameFields />
          </ActionForm>
        </div>
      </details>
      <SearchBar placeholder={t("search")} defaultValue={sp.q} />
      <div className="space-y-2">
        {games.map((g) => (
          <details key={g.id} className="card group">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
              <GameCover name={g.name} src={coverUrl(g)} size="xs" />
              <span className="flex-1 font-semibold">
                {g.name} {g.year && <span className="text-xs font-normal text-muted">({g.year})</span>}
              </span>
              <span className="text-xs text-muted">{t("usage", { copies: g._count.libraryGames, plays: g._count.plays, events: g._count.eventGames })}</span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <ActionForm action={saveGameAction.bind(null, g.id)} submitLabel={t("save")}>
                <GameFields values={g} />
              </ActionForm>
              <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
                <form action={mergeGameAction.bind(null, g.id)} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="label">{t("mergeInto")}</label>
                    <select name="intoId" className="select w-64" required defaultValue="">
                      <option value="" disabled>
                        —
                      </option>
                      {all
                        .filter((o) => o.id !== g.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <ConfirmButton message={t("mergeConfirm", { name: g.name })} className="btn btn-secondary btn-sm">
                    {t("merge")}
                  </ConfirmButton>
                </form>
                <form action={deleteGameAction.bind(null, g.id)} className="ml-auto">
                  <ConfirmButton message={t("deleteConfirm", { name: g.name })}>{t("delete")}</ConfirmButton>
                </form>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

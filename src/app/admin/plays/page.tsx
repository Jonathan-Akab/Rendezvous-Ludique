import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader, AdminTable, SearchBar, Td } from "@/modules/admin/components/AdminUi";
import { adminDeletePlayAction } from "@/modules/admin/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("plays") };
}

export default async function AdminPlaysPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("plays");
  const [sp, t, format] = await Promise.all([searchParams, getTranslations("admin.plays"), getFormatter()]);
  const plays = await db.play.findMany({
    where: sp.q ? { OR: [{ game: { name: ilike(sp.q) } }, { createdBy: { displayName: ilike(sp.q) } }] } : {},
    include: {
      game: { select: { name: true } },
      createdBy: { select: { id: true, displayName: true } },
      participants: { include: { user: { select: { displayName: true } } } },
    },
    orderBy: { playedAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <AdminHeader title={t("title")} lead={t("lead", { count: plays.length })} />
      <SearchBar placeholder={t("search")} defaultValue={sp.q} />
      <AdminTable head={[t("game"), t("date"), t("loggedBy"), t("players"), ""]}>
        {plays.map((p) => (
          <tr key={p.id}>
            <Td className="font-semibold">{p.game.name}</Td>
            <Td className="whitespace-nowrap text-xs">{format.dateTime(p.playedAt, { dateStyle: "medium" })}</Td>
            <Td>
              <Link href={`/admin/members/${p.createdBy.id}`} className="hover:text-accent">
                {p.createdBy.displayName}
              </Link>
            </Td>
            <Td className="text-xs">
              {p.participants.map((x) => (
                <span key={x.id} className={`mr-2 ${x.status === "PENDING" ? "text-muted" : x.status === "DECLINED" ? "line-through text-muted" : ""}`}>
                  {x.user?.displayName ?? x.guestName}
                  {x.isWinner && " 👑"}
                </span>
              ))}
            </Td>
            <Td>
              <form action={adminDeletePlayAction.bind(null, p.id)} className="flex justify-end">
                <ConfirmButton message={t("deleteConfirm")}>{t("delete")}</ConfirmButton>
              </form>
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

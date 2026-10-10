import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { matchIds } from "@/lib/search";
import { ConfirmButton } from "@/components/forms";
import { Meeple } from "@/components/Meeple";
import { AdminHeader, AdminTable, SearchBar, Td } from "@/modules/admin/components/AdminUi";
import { adminDeleteLibraryAction } from "@/modules/admin/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("libraries") };
}

export default async function AdminLibrariesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("libraries");
  const [sp, t, format] = await Promise.all([searchParams, getTranslations("admin.libraries"), getFormatter()]);
  const libraries = await db.library.findMany({
    where: sp.q ? { OR: [{ id: { in: await matchIds("Library", ["name"], sp.q) } }, { members: { some: { userId: { in: await matchIds("User", ["displayName"], sp.q) } } } }] } : {},
    include: {
      members: { include: { user: { select: { id: true, displayName: true, meepleColor: true } } } },
      _count: { select: { games: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <AdminHeader title={t("title")} lead={t("lead", { count: libraries.length })} />
      <SearchBar placeholder={t("search")} defaultValue={sp.q} />
      <AdminTable head={[t("name"), t("members"), t("games"), t("created"), ""]}>
        {libraries.map((l) => (
          <tr key={l.id}>
            <Td className="font-semibold">{l.name}</Td>
            <Td>
              <div className="flex flex-wrap gap-2">
                {l.members.map((m) => (
                  <Link key={m.id} href={`/admin/members/${m.user.id}`} className={`chip ${m.status === "PENDING" ? "opacity-50" : ""}`}>
                    <Meeple color={m.user.meepleColor} size={14} /> {m.user.displayName}
                    {m.role === "OWNER" && " ★"}
                  </Link>
                ))}
              </div>
            </Td>
            <Td>{l._count.games}</Td>
            <Td className="text-xs text-muted">{format.dateTime(l.createdAt, { dateStyle: "medium" })}</Td>
            <Td>
              <form action={adminDeleteLibraryAction.bind(null, l.id)} className="flex justify-end">
                <ConfirmButton message={t("deleteConfirm", { name: l.name })}>{t("delete")}</ConfirmButton>
              </form>
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

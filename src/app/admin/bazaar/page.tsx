import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { matchIds } from "@/lib/search";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader, AdminTable, SearchBar, Td } from "@/modules/admin/components/AdminUi";
import { deleteListingAction, setListingStatusAction } from "@/modules/bazaar/actions";
import { formatPrice } from "@/modules/bazaar/components/ListingCard";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("bazaar") };
}

export default async function AdminBazaarPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("bazaar");
  const [{ q }, mod, t, tb, format, locale] = await Promise.all([
    searchParams,
    getModule("bazaar"),
    getTranslations("admin.bazaar"),
    getTranslations("bazaar"),
    getFormatter(),
    getLocale(),
  ]);
  const listings = await db.bazaarListing.findMany({
    where: q ? { OR: [{ id: { in: await matchIds("BazaarListing", ["title"], q) } }, { sellerId: { in: await matchIds("User", ["displayName"], q) } }] } : {},
    include: { seller: { select: { id: true, displayName: true } }, _count: { select: { messages: true, photos: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const currency = String(mod.settings.currency) || "CAD";

  return (
    <div>
      <AdminHeader title={t("title")} lead={t("lead", { count: listings.length })} />
      <SearchBar placeholder={t("search")} defaultValue={q} />
      <AdminTable head={[t("listing"), t("seller"), t("price"), t("status"), t("activity"), t("date"), ""]}>
        {listings.map((l) => (
          <tr key={l.id}>
            <Td>
              <Link href={`/bazaar/${l.id}`} target="_blank" className="font-semibold hover:text-accent">
                {l.title}
              </Link>
              <span className="block text-xs text-muted">{tb(`kinds.${l.kind}`)}</span>
            </Td>
            <Td>
              <Link href={`/admin/members/${l.seller.id}`} className="hover:text-accent">
                {l.seller.displayName}
              </Link>
            </Td>
            <Td>{formatPrice(l.price, currency, locale) ?? "—"}</Td>
            <Td>
              <span className="chip">{tb(`statuses.${l.status}`)}</span>
            </Td>
            <Td className="text-xs text-muted">{t("counts", { photos: l._count.photos, messages: l._count.messages })}</Td>
            <Td className="whitespace-nowrap text-xs text-muted">{format.dateTime(l.createdAt, { dateStyle: "medium" })}</Td>
            <Td>
              <div className="flex justify-end gap-1">
                {l.status !== "SOLD" && (
                  <form action={setListingStatusAction.bind(null, l.id, "SOLD")}>
                    <button className="btn btn-ghost btn-sm">{tb("statuses.SOLD")}</button>
                  </form>
                )}
                <form action={deleteListingAction.bind(null, l.id)}>
                  <ConfirmButton message={t("deleteConfirm", { title: l.title })}>{t("delete")}</ConfirmButton>
                </form>
              </div>
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminHeader, AdminTable, Td } from "@/modules/admin/components/AdminUi";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("audit") };
}

export default async function AdminAuditPage() {
  const [t, format] = await Promise.all([getTranslations("admin.audit"), getFormatter()]);
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { displayName: true } } } });
  return (
    <div>
      <AdminHeader title={t("title")} lead={t("lead")} />
      <AdminTable head={[t("when"), t("who"), t("action"), t("target"), t("details")]}>
        {logs.map((l) => (
          <tr key={l.id}>
            <Td className="whitespace-nowrap text-xs text-muted">{format.dateTime(l.createdAt, { dateStyle: "short", timeStyle: "medium" })}</Td>
            <Td>{l.actor?.displayName ?? "—"}</Td>
            <Td>
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{l.action}</code>
            </Td>
            <Td className="text-sm">{l.target}</Td>
            <Td className="max-w-md truncate font-mono text-xs text-muted" >{l.details}</Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

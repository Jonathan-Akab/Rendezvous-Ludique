import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";
import { FacebookTabs } from "@/modules/facebook/components/FacebookTabs";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("facebook") };
}

export default async function FacebookPage() {
  const [, , t] = await Promise.all([requireUser(), requireModule("facebook"), getTranslations("facebook")]);
  const groups = await db.facebookGroup.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, url: true, description: true, region: true },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      {groups.length === 0 ? <EmptyState title={t("empty")} /> : <FacebookTabs groups={groups} />}
    </div>
  );
}

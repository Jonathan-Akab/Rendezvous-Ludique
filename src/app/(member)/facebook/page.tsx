import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FacebookBoard, type FbItem } from "@/modules/facebook/components/FacebookBoard";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("facebook") };
}

export default async function FacebookPage() {
  const [user, mod, t] = await Promise.all([requireUser(), requireModule("facebook"), getTranslations("facebook")]);
  const featuredUrl = String(mod.settings.featuredUrl ?? "").trim();
  const showFeatured = mod.settings.showFeatured !== false && Boolean(featuredUrl);
  const groups = await db.facebookGroup.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, url: true, description: true, region: true },
  });
  const items: FbItem[] = [
    ...(showFeatured ? [{ key: "featured", kind: "page" as const, url: featuredUrl, name: String(mod.settings.featuredName || "Facebook") }] : []),
    ...groups.map((g) => ({ key: g.id, kind: "group" as const, group: g })),
  ];
  let pins: string[] = [];
  try {
    pins = user.facebookPins ? JSON.parse(user.facebookPins) : [];
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      {/* the promoted page (Admin → Modules → Groupes Facebook), then the groups; members pin their favourites */}
      {items.length > 0 ? <FacebookBoard items={items} pins={pins} /> : <EmptyState title={t("empty")} />}
      {groups.length > 0 && <p className="text-xs text-muted">{t("note")}</p>}
    </div>
  );
}

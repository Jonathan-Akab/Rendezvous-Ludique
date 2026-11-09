import { getLocale, getTranslations } from "next-intl/server";
import { getModule } from "@/lib/modules";
import { FacebookPageTile } from "@/modules/facebook/components/FacebookPageTile";
import { FacebookGroupTile } from "@/modules/facebook/components/FacebookGroupTile";
import { demoGroup } from "@/modules/demo/data";

export default async function DemoFacebook() {
  const [t, locale, fb] = await Promise.all([getTranslations("facebook"), getLocale(), getModule("facebook")]);
  const featured = String(fb.settings.featuredUrl ?? "").trim();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      <div data-guide="demo-facebook" className="grid max-w-3xl grid-cols-2 gap-3 sm:gap-5">
        {featured && <FacebookPageTile url={featured} name={String(fb.settings.featuredName || "Facebook")} />}
        <FacebookGroupTile group={demoGroup(locale === "en" ? "en" : "fr")} />
      </div>
    </div>
  );
}

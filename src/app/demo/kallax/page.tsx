import { getTranslations } from "next-intl/server";
import { KallaxShelf } from "@/modules/kallax/components/KallaxShelf";
import { demoShelf } from "@/modules/demo/data";

export default async function DemoKallax() {
  const t = await getTranslations("demo");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t("nav.kallax")}</h1>
        <p className="text-muted">{t("kallax.lead")}</p>
      </div>
      <div data-guide="demo-kallax">
        <KallaxShelf games={demoShelf()} editable={false} shared={false} />
      </div>
    </div>
  );
}

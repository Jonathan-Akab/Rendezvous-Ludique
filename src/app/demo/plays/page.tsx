import { getLocale, getTranslations } from "next-intl/server";
import { PlayCard } from "@/modules/plays/components/PlayCard";
import { DemoClock } from "@/modules/demo/components/DemoClock";
import { DEMO_ME, demoPlays } from "@/modules/demo/data";

export default async function DemoPlays() {
  const [t, locale] = await Promise.all([getTranslations("demo"), getLocale()]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t("nav.plays")}</h1>
        <p className="text-muted">{t("plays.lead")}</p>
      </div>
      <div data-guide="demo-clock" className="card card-pad space-y-2">
        <h2 className="section-title text-base">{t("plays.clockTitle")}</h2>
        <DemoClock />
      </div>
      <div data-guide="demo-plays" className="space-y-3">
        {demoPlays(locale === "en" ? "en" : "fr").map((p) => (
          <PlayCard key={p.id} play={p} viewerId={`${DEMO_ME.id}-viewer`} />
        ))}
      </div>
    </div>
  );
}

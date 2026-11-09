import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { GameCover } from "@/modules/games/components/GameCover";
import { demoFaqGames } from "@/modules/demo/dataAi";

/** The demo rules FAQ: games with questions already answered. */
export default async function DemoFaqIndex() {
  const [ta, locale] = await Promise.all([getTranslations("ai"), getLocale()]);
  const games = demoFaqGames(locale === "en" ? "en" : "fr");
  const section = (title: string, list: typeof games) => (
    <section className="space-y-3">
      <h2 className="section-title text-base">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((g) => (
          <Link key={g.gameId} href={`/demo/ai/faq/${g.gameId}`} className="card-hover flex items-center gap-3 rounded-2xl p-3">
            <GameCover name={g.name} src={null} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{g.name}</span>
              <span className="text-xs text-muted">{ta("faq.count", { count: g.count })}</span>
            </span>
            <ChevronRight className="size-5 text-muted" />
          </Link>
        ))}
      </div>
    </section>
  );
  return (
    <div className="space-y-6">
      <Link href="/demo/ai" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
        <ArrowLeft className="size-4" /> {ta("faq.backToAi")}
      </Link>
      <div>
        <h1 className="page-title">{ta("faq.title")}</h1>
        <p className="text-muted">{ta("faq.lead")}</p>
      </div>
      {section(ta("faq.myGames"), games.filter((g) => g.mine))}
      {section(ta("faq.otherGames"), games.filter((g) => !g.mine))}
    </div>
  );
}

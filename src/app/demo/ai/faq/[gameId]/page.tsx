import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, BadgeCheck, Lock, Search } from "lucide-react";
import { GameCover } from "@/modules/games/components/GameCover";
import { demoFaq } from "@/modules/demo/dataAi";

/** One game's FAQ in the demo: questions already answered, most asked first. */
export default async function DemoFaqGame({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ gameId }, { q = "" }, t, ta, locale] = await Promise.all([params, searchParams, getTranslations("demo"), getTranslations("ai"), getLocale()]);
  const faq = demoFaq(locale === "en" ? "en" : "fr", gameId);
  if (!faq) notFound();
  const needle = q.trim().toLowerCase();
  const entries = faq.entries.filter((e) => !needle || `${e.q} ${e.a}`.toLowerCase().includes(needle)).sort((a, b) => b.asked - a.asked);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/demo/ai/faq" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
        <ArrowLeft className="size-4" /> {ta("faq.back")}
      </Link>
      <div className="flex items-center gap-4">
        <GameCover name={faq.name} src={null} size="sm" />
        <div>
          <h1 className="page-title text-2xl sm:text-3xl">{ta("faq.gameCard", { name: faq.name })}</h1>
          <p className="text-sm text-muted">{ta("faq.gameLead")}</p>
        </div>
      </div>
      <form className="relative" role="search">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input name="q" defaultValue={q} placeholder={ta("faq.searchPlaceholder")} className="input pl-9" aria-label={ta("faq.searchPlaceholder")} />
      </form>
      {needle && <p className="text-sm text-muted">{ta("faq.count", { count: entries.length })}</p>}
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id}>
            <details className="card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                <span className="flex-1 font-semibold">{e.q}</span>
                {e.verified && (
                  <span className="chip shrink-0 gap-1 border-success/40 text-success">
                    <BadgeCheck className="size-3" /> {ta("faq.verified")}
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted">{ta("faq.asked", { count: e.asked })}</span>
              </summary>
              <div className="space-y-2 border-t border-line/70 px-4 py-3 text-sm leading-relaxed">
                <p>{e.a}</p>
                <p className="flex flex-wrap gap-1.5">
                  {e.pages.map((p) => (
                    <span key={p} className="chip chip-accent">
                      📖 {t("ai.page", { n: p })}
                    </span>
                  ))}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <div className="card flex flex-wrap items-center justify-center gap-3 p-4 text-center text-sm">
        <span className="text-muted">{ta("faq.notFound")}</span>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Lock className="size-4 text-accent" /> {t("ai.locked")}
        </span>
      </div>
    </div>
  );
}

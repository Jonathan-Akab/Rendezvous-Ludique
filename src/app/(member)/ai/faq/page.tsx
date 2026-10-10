import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, MessageCircleQuestion, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/similarity";
import { EmptyState } from "@/components/EmptyState";
import { GameCover } from "@/modules/games/components/GameCover";
import { coverUrl } from "@/modules/games/service";
import { getMyKallaxGames } from "@/modules/kallax/service";
import { faqCounts, faqEnabled } from "@/modules/ai/faq";
import { AiGameSelect } from "@/modules/ai/components/AiGameSelect";

export async function generateMetadata() {
  return { title: (await getTranslations("ai.faq"))("title") };
}

type Card = { id: string; name: string; cover: string | null; count: number };
type Query = { q?: string; src?: string };

export default async function FaqIndexPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [user, mod, sp, t] = await Promise.all([requireUser(), requireModule("ai"), searchParams, getTranslations("ai.faq")]);
  if (!(await faqEnabled(mod))) notFound();

  const [counts, mine] = await Promise.all([faqCounts(mod), getMyKallaxGames(user.id)]);
  const mineIds = new Set(mine.map((g) => g.gameId));
  const others = await db.game.findMany({
    where: { id: { in: [...counts.keys()].filter((id) => !mineIds.has(id)) } },
    select: { id: true, name: true, coverFileId: true, imageUrl: true },
    orderBy: { name: "asc" },
  });

  // The tab chosen above decides which games are listed below.
  const src = sp.src === "ludo" ? "ludo" : "kallax";
  const q = normalizeText(sp.q ?? "");
  const keep = (c: Card) => !q || normalizeText(c.name).includes(q);
  const myCards: Card[] = mine.map((g) => ({ id: g.gameId, name: g.name, cover: g.cover, count: counts.get(g.gameId) ?? 0 })).filter(keep);
  const otherCards: Card[] = others.map((g) => ({ id: g.id, name: g.name, cover: coverUrl(g), count: counts.get(g.id) ?? 0 })).filter(keep);

  const grid = (cards: Card[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.id} href={`/ai/faq/${c.id}`} className="card-hover flex items-center gap-3 rounded-2xl p-3">
          <GameCover name={c.name} src={c.cover} size="xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c.name}</span>
            <span className="text-xs text-muted">{t("count", { count: c.count })}</span>
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/ai" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {t("backToAi")}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <MessageCircleQuestion className="size-8 text-accent" /> {t("title")}
          </h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <form className="relative w-full max-w-xs" role="search">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="hidden" name="src" value={src} />
          <input name="q" defaultValue={sp.q} placeholder={t("searchGames")} className="input pl-9" aria-label={t("searchGames")} />
        </form>
      </div>

      <div className="glass space-y-3 rounded-3xl p-5">
        <p className="font-semibold">{t("pickGame")}</p>
        <AiGameSelect games={mine} canUpload={false} hrefBase="/ai/faq/" initialSource={src} syncUrl />
      </div>

      {(src === "kallax" ? myCards : otherCards).length === 0 ? (
        <EmptyState title={t(src === "kallax" ? "noKallaxGames" : "noGames")} text={t(src === "kallax" ? "noKallaxGamesHint" : "noGamesHint")} />
      ) : (
        <section className="space-y-3">
          <h2 className="section-title">{t(src === "kallax" ? "myGames" : "ludoGames")}</h2>
          {grid(src === "kallax" ? myCards : otherCards)}
        </section>
      )}
    </div>
  );
}

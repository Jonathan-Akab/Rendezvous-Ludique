import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BadgeCheck, BookOpen, Search, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";
import { GameCover } from "@/modules/games/components/GameCover";
import { coverUrl, inMemberKallax } from "@/modules/games/service";
import { faqEnabled, searchFaq } from "@/modules/ai/faq";
import type { Citation } from "@/modules/ai/service";
import { RulebookLink } from "@/modules/games/components/RulebookOverlay";

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }) {
  const [{ gameId }, t] = await Promise.all([params, getTranslations("ai.faq")]);
  const game = await db.game.findUnique({ where: { id: gameId }, select: { name: true } });
  return { title: game ? t("gameCard", { name: game.name }) : t("title") };
}

export default async function GameFaqPage({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<{ q?: string }> }) {
  const [user, mod, { gameId }, sp, t] = await Promise.all([requireUser(), requireModule("ai"), params, searchParams, getTranslations("ai")]);
  if (!(await faqEnabled(mod))) notFound();
  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) notFound();

  const [entries, mine] = await Promise.all([searchFaq(game.id, sp.q ?? "", mod), inMemberKallax(user.id, game.id)]);
  const askAi = mine ? (
    <Link href={`/ai?game=${game.id}`} className="btn btn-primary">
      <Sparkles className="size-4" /> {t("faq.askAi")}
    </Link>
  ) : null;

  return (
    <div className="space-y-6">
      <Link href="/ai/faq" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {t("faq.back")}
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <GameCover name={game.name} src={coverUrl(game)} size="sm" />
        <div className="min-w-0 flex-1">
          <h1 className="page-title text-2xl sm:text-3xl">{t("faq.gameCard", { name: game.name })}</h1>
          <p className="text-sm text-muted">{t("faq.gameLead")}</p>
        </div>
        {askAi}
      </div>

      <form className="relative" role="search">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input name="q" defaultValue={sp.q} placeholder={t("faq.searchPlaceholder")} className="input pl-9" aria-label={t("faq.searchPlaceholder")} />
      </form>

      {entries.length === 0 ? (
        <EmptyState title={sp.q ? t("faq.noMatch") : t("faq.empty")} text={mine ? t("faq.emptyHint") : undefined}>
          {askAi}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {sp.q && <p className="text-sm text-muted">{t("faq.count", { count: entries.length })}</p>}
          {entries.map((e, i) => {
            const citations: Citation[] = e.citations ? JSON.parse(e.citations) : [];
            return (
              <details key={e.id} className="card group" open={i === 0 && Boolean(sp.q)}>
                <summary className="flex cursor-pointer items-start gap-3 p-4">
                  <span className="flex-1 font-semibold">{e.question}</span>
                  {e.status === "VERIFIED" && (
                    <span className="chip chip-accent shrink-0 gap-1 text-[11px]">
                      <BadgeCheck className="size-3" /> {t("faq.verified")}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted">{t("faq.asked", { count: e.askCount })}</span>
                </summary>
                <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
                  <div className="prose-chat text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.answer}</ReactMarkdown>
                  </div>
                  {citations.some((c) => c.fileId ?? e.rulebook) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {citations.map((c, j) => (
                        <RulebookLink key={j} fileId={(c.fileId ?? e.rulebook?.fileId)!} page={c.page} title={`${game.name} — ${c.title ?? e.rulebook?.title ?? ""}`} hint={c.text} className="chip gap-1 hover:border-accent hover:text-accent">
                          <BookOpen className="size-3" />
                          {(c.title ?? e.rulebook?.title) && <span className="max-w-40 truncate">{c.title ?? e.rulebook?.title} ·</span>}
                          {c.endPage > c.page ? t("pages", { from: c.page, to: c.endPage }) : t("page", { page: c.page })}
                        </RulebookLink>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
          {askAi && <p className="pt-2 text-center text-sm text-muted">{t("faq.notFound")}</p>}
          {askAi && <div className="flex justify-center">{askAi}</div>}
        </div>
      )}
    </div>
  );
}

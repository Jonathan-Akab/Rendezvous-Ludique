import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BookOpen, Brain, ChevronRight, FileUp, MessageCircleQuestion, MessageSquarePlus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getModule, requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { ConfirmButton } from "@/components/forms";
import { GameCover } from "@/modules/games/components/GameCover";
import { ActionForm } from "@/components/ActionForm";
import { AiGameSelect } from "@/modules/ai/components/AiGameSelect";
import { uploadRulebookAction } from "@/modules/games/actions";
import { coverUrl } from "@/modules/games/service";
import { AiChat, type ChatMessage } from "@/modules/ai/components/AiChat";
import { aiConfigured } from "@/modules/ai/service";
import { getAiStatus } from "@/modules/ai/policy";
import { getMyKallaxGames } from "@/modules/kallax/service";
import { deleteChatAction } from "@/modules/ai/actions";
import { faqCounts, faqEnabled } from "@/modules/ai/faq";
import { ownKeysAllowed } from "@/modules/ai/ownKey";
import { getSiteSettings } from "@/lib/settings";
import { RulebookLink } from "@/modules/games/components/RulebookOverlay";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("ai") };
}

type Search = { chat?: string; game?: string; rulebook?: string };

export default async function AiPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, mod, sp, t, tg, format, gamesMod] = await Promise.all([
    requireUser(),
    requireModule("ai"),
    searchParams,
    getTranslations("ai"),
    getTranslations("games"),
    getFormatter(),
    getModule("games"),
  ]);

  const [chats, status, myGames] = await Promise.all([
    db.aiChat.findMany({ where: { userId: user.id }, include: { game: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    getAiStatus(user.id, mod),
    getMyKallaxGames(user.id),
  ]);
  const { siteName } = await getSiteSettings();
  const used = status.usedToday;
  const limit = status.dailyLimit;
  const disabledReason =
    status.access === "NONE"
      ? t("errors.blocked")
      : status.own.available
        ? undefined // the member's own credits: no site limit applies
        : used >= limit
        ? t("errors.limit")
        : !status.claude.available && !status.free.available
          ? t(status.claude.reason === "siteBudget" || status.claude.reason === "memberBudget" ? "errors.budget" : "errors.notConfigured")
          : undefined;
  const providerInfo = {
    claudeAvailable: status.claude.available,
    claudeReason: status.claude.reason ?? null,
    freeAvailable: status.free.available,
    freeName: status.free.name,
    budgetUsedPct: status.claude.budget > 0 ? Math.min(100, Math.round((status.claude.spent / status.claude.budget) * 100)) : null,
    ownAllowed: ownKeysAllowed(mod) && status.access !== "NONE",
    ownAvailable: status.own.available,
    ownHint: status.own.hint,
    siteName,
  };

  const chat = sp.chat
    ? await db.aiChat.findFirst({
        where: { id: sp.chat, userId: user.id },
        include: { game: true, rulebook: true, messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;
  const game = chat?.game ?? (sp.game && myGames.some((g) => g.gameId === sp.game) ? await db.game.findUnique({ where: { id: sp.game } }) : null);
  // Every PDF rulebook of the game is read for every question (same order as the chat API).
  // the game's rulebooks and its expansions' (same order as the chat API)
  const rulebooks = game ? await db.rulebook.findMany({ where: { game: { OR: [{ id: game.id }, { baseGameId: game.id }] } }, orderBy: { createdAt: "asc" }, take: 6 }) : [];
  // Ready to chat: an existing conversation, a game with rulebooks, or a game without any
  // rulebook once the member chose to upload one or go with general knowledge.
  const ready = Boolean(chat) || Boolean(game && (rulebooks.length > 0 || sp.rulebook !== undefined));
  const canUpload = Boolean(gamesMod.settings.allowRulebookUploads) || user.role === "ADMIN";
  const uploadForm = game && (
    <ActionForm action={uploadRulebookAction.bind(null, game.id)} submitLabel={t("uploadAndAsk")} className="mt-4 space-y-3">
      <input type="hidden" name="then" value="ai" />
      <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
        <input name="title" className="input" placeholder={tg("rulebooks.titlePlaceholder")} maxLength={120} />
        <select name="language" className="select" defaultValue="fr">
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
      <input name="file" type="file" accept="application/pdf" required className="input" />
      <p className="text-xs text-muted">{tg("rulebooks.hint")}</p>
    </ActionForm>
  );

  const faqOn = await faqEnabled(mod);
  const faqCount = faqOn && game ? ((await faqCounts(mod, [game.id])).get(game.id) ?? 0) : 0;
  // Answers that came from the FAQ keep the FAQ entry's id in `model`.
  const faqIds = (chat?.messages ?? []).filter((m) => m.provider === "faq" && m.model).map((m) => m.model!);
  const faqEntries = faqIds.length ? await db.ruleFaq.findMany({ where: { id: { in: faqIds } }, select: { id: true, question: true, status: true } }) : [];

  const messages: ChatMessage[] = (chat?.messages ?? []).map((m) => {
    const faq = m.provider === "faq" ? faqEntries.find((e) => e.id === m.model) : undefined;
    return {
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      citations: m.citations ? JSON.parse(m.citations) : [],
      provider: m.provider,
      faq: faq ? { question: faq.question, verified: faq.status === "VERIFIED" } : null,
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <Link href="/ai" className="btn btn-primary w-full">
          <MessageSquarePlus className="size-4" /> {t("newChat")}
        </Link>
        {faqOn && (
          <Link href="/ai/faq" className="btn btn-secondary w-full">
            <MessageCircleQuestion className="size-4" /> {t("faq.title")}
          </Link>
        )}
        <p className="px-1 text-xs text-muted">{t("usage", { used, limit })}</p>
        <nav className="space-y-1" aria-label={t("history")}>
          {chats.map((c) => (
            <Link
              key={c.id}
              href={`/ai?chat=${c.id}`}
              className={`block rounded-xl px-3 py-2 text-sm transition ${c.id === chat?.id ? "bg-accent/15 font-semibold" : "hover:bg-surface-2/70"}`}
            >
              <span className="block truncate">{c.title}</span>
              <span className="block truncate text-[11px] text-muted">
                {c.game?.name ?? t("noGame")} · {format.relativeTime(c.updatedAt)}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 space-y-4">
        {user.role === "ADMIN" && !aiConfigured() && (
          <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
            <p className="font-semibold text-danger">{t("errors.notConfigured")}</p>
            <p className="mt-1 text-muted">{t("setupAdmin")}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          {game ? (
            <>
              <GameCover name={game.name} src={coverUrl(game)} size="sm" />
              <div className="min-w-0 flex-1">
                <h1 className="page-title text-2xl sm:text-3xl">{game.name}</h1>
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  {!ready ? null : rulebooks.length ? (
                    <>
                      <BookOpen className="size-4 shrink-0 text-accent" /> {t("withRulebooks", { count: rulebooks.length })}
                    </>
                  ) : (
                    <>
                      <Brain className="size-4 text-accent" /> {t("generalKnowledge")}
                    </>
                  )}
                </p>
              </div>
              {chat && (
                <form action={deleteChatAction.bind(null, chat.id)}>
                  <ConfirmButton message={t("deleteConfirm")} className="btn btn-ghost btn-sm text-muted">
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </form>
              )}
            </>
          ) : (
            <div>
              <h1 className="page-title">
                <span className="text-gradient">{t("title")}</span>
              </h1>
              <p className="text-muted">{t("lead")}</p>
            </div>
          )}
        </div>

        {!game && !chat && (
          <div className="glass space-y-3 rounded-3xl p-5">
            <p className="font-semibold">{t("pickGame")}</p>
            <AiGameSelect games={myGames} />
            <p className="text-xs text-muted">{t("pickGameHint")}</p>
          </div>
        )}

        {faqOn && game && !chat && (
          <Link href={`/ai/faq/${game.id}`} className="card-hover flex items-center gap-3 rounded-2xl p-4">
            <MessageCircleQuestion className="size-6 shrink-0 text-accent" />
            <span className="flex-1">
              <span className="block font-semibold">{t("faq.gameCard", { name: game.name })}</span>
              <span className="text-xs text-muted">{t("faq.gameCardHint", { count: faqCount })}</span>
            </span>
            <ChevronRight className="size-5 text-muted" />
          </Link>
        )}

        {game && !chat && !ready && (
          <div className="glass space-y-3 rounded-3xl p-5">
            <p className="font-semibold">{t("pickSource")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {canUpload && (
                <details className="card-hover rounded-2xl p-4 sm:col-span-2" open>
                  <summary className="flex cursor-pointer items-center gap-3">
                    <FileUp className="size-6 text-accent" />
                    <span>
                      <span className="block font-semibold">{t("uploadRulebook")}</span>
                      <span className="text-xs text-muted">{t("uploadRulebookHint")}</span>
                    </span>
                  </summary>
                  {uploadForm}
                </details>
              )}
              {mod.settings.allowGeneralKnowledge && (
                <Link href={`/ai?game=${game.id}&rulebook=`} className="card-hover flex items-center gap-3 rounded-2xl p-4">
                  <Brain className="size-6 text-accent" />
                  <span>
                    <span className="block font-semibold">{t("generalKnowledge")}</span>
                    <span className="text-xs text-muted">{t("generalHint")}</span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}

        {ready && (
          <>
            {game && rulebooks.length > 0 && (
              <details className="glass rounded-2xl px-4 py-3 text-sm">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <BookOpen className="size-4 text-accent" />
                  <span className="font-semibold">{t("readingRulebooks")}</span>
                  {rulebooks.map((rb) => (
                    <RulebookLink key={rb.id} fileId={rb.fileId} title={`${game.name} — ${rb.title}`} className="chip hover:border-accent hover:text-accent">
                      {rb.title} · {rb.language.toUpperCase()}
                    </RulebookLink>
                  ))}
                  {canUpload && <span className="ml-auto text-xs text-muted">{t("addRulebook")}</span>}
                </summary>
                {canUpload && uploadForm}
              </details>
            )}
            {game && rulebooks.length === 0 && (
              <p className="glass rounded-2xl px-4 py-3 text-sm text-muted">
                {t("noRulebookYet")}{" "}
                {!chat && (
                  <Link href={`/ai?game=${game.id}`} className="link">
                    {t("uploadOne")}
                  </Link>
                )}
              </p>
            )}
            <AiChat
              key={chat?.id ?? `${game?.id}-new`}
              chatId={chat?.id}
              gameId={game?.id}
              bookCount={rulebooks.length}
              fallbackFileId={chat?.rulebook?.fileId}
              initialMessages={messages}
              meepleColor={user.meepleColor}
              // When the AI can't answer (limit, budget, not set up), the game's FAQ still can.
              disabledReason={status.access !== "NONE" && faqCount > 0 ? undefined : disabledReason}
              aiUnavailable={status.access !== "NONE" && faqCount > 0 ? disabledReason : undefined}
              providerInfo={providerInfo}
              initialProvider={status.own.available ? "own" : status.access === "FREE_ONLY" ? "free" : status.preferred}
            />
          </>
        )}
      </section>
    </div>
  );
}

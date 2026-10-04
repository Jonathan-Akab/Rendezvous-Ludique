import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BookOpen, Brain, FileUp, MessageSquarePlus, Trash2 } from "lucide-react";
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
import { deleteChatAction } from "@/modules/ai/actions";

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

  const [chats, status] = await Promise.all([
    db.aiChat.findMany({ where: { userId: user.id }, include: { game: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 40 }),
    getAiStatus(user.id, mod),
  ]);
  const used = status.usedToday;
  const limit = status.dailyLimit;
  const disabledReason =
    status.access === "NONE"
      ? t("errors.blocked")
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
  };

  const chat = sp.chat
    ? await db.aiChat.findFirst({
        where: { id: sp.chat, userId: user.id },
        include: { game: true, rulebook: true, messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;
  const game = chat?.game ?? (sp.game ? await db.game.findUnique({ where: { id: sp.game } }) : null);
  const rulebooks = game && !chat ? await db.rulebook.findMany({ where: { gameId: game.id }, orderBy: { createdAt: "desc" } }) : [];
  const rulebook = chat?.rulebook ?? rulebooks.find((r) => r.id === sp.rulebook) ?? null;
  // Ready to chat: an existing conversation, or a game picked and a source chosen.
  // The source step (rulebook / upload / general knowledge) always comes before the chat.
  const ready = Boolean(chat) || Boolean(game && sp.rulebook !== undefined);

  const messages: ChatMessage[] = (chat?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    citations: m.citations ? JSON.parse(m.citations) : [],
    provider: m.provider,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <Link href="/ai" className="btn btn-primary w-full">
          <MessageSquarePlus className="size-4" /> {t("newChat")}
        </Link>
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
                  {!ready ? null : rulebook ? (
                    <>
                      <BookOpen className="size-4 text-accent" /> {t("withRulebook", { title: rulebook.title })}
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
            <AiGameSelect />
            <p className="text-xs text-muted">{t("pickGameHint")}</p>
          </div>
        )}

        {game && !chat && !ready && (
          <div className="glass space-y-3 rounded-3xl p-5">
            <p className="font-semibold">{t("pickSource")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {rulebooks.map((rb) => (
                <Link key={rb.id} href={`/ai?game=${game.id}&rulebook=${rb.id}`} className="card-hover flex items-center gap-3 rounded-2xl p-4">
                  <BookOpen className="size-6 text-accent" />
                  <span>
                    <span className="block font-semibold">{rb.title}</span>
                    <span className="text-xs text-muted">{t("rulebookOption", { lang: rb.language.toUpperCase() })}</span>
                  </span>
                </Link>
              ))}
              {(gamesMod.settings.allowRulebookUploads || user.role === "ADMIN") && (
                <details className="card-hover rounded-2xl p-4 sm:col-span-2" open={rulebooks.length === 0}>
                  <summary className="flex cursor-pointer items-center gap-3">
                    <FileUp className="size-6 text-accent" />
                    <span>
                      <span className="block font-semibold">{t("uploadRulebook")}</span>
                      <span className="text-xs text-muted">{t("uploadRulebookHint")}</span>
                    </span>
                  </summary>
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
            {game && !rulebook && rulebooks.length === 0 && !chat && (
              <p className="glass rounded-2xl px-4 py-3 text-sm text-muted">
                {t("noRulebookYet")}{" "}
                <Link href={`/ai?game=${game.id}`} className="link">
                  {t("uploadOne")}
                </Link>
              </p>
            )}
            <AiChat
              key={chat?.id ?? `${game?.id}-${rulebook?.id ?? "general"}`}
              chatId={chat?.id}
              gameId={game?.id}
              rulebookId={rulebook?.id}
              rulebookFileId={rulebook?.fileId}
              initialMessages={messages}
              meepleColor={user.meepleColor}
              disabledReason={disabledReason}
              providerInfo={providerInfo}
              initialProvider={status.access === "FREE_ONLY" ? "free" : status.preferred}
            />
          </>
        )}
      </section>
    </div>
  );
}

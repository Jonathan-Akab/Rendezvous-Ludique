import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, BookOpen, ChevronRight, Lock, MessageCircleQuestion, MessageSquarePlus, Sparkles, UserPlus } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { GameCover } from "@/modules/games/components/GameCover";
import { DEMO_ME } from "@/modules/demo/data";
import { demoAiChats, demoFaq } from "@/modules/demo/dataAi";

/** The rules AI in the demo: the real page's layout, sample conversations, no asking. */
export default async function DemoAi({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const [{ chat: chatId }, t, ta, locale] = await Promise.all([searchParams, getTranslations("demo"), getTranslations("ai"), getLocale()]);
  const lang = locale === "en" ? "en" : "fr";
  const chats = demoAiChats(lang);
  const chat = chats.find((c) => c.id === chatId) ?? chats[0];
  const faqCount = demoFaq(lang, chat.gameId)?.entries.length ?? 0;
  const ago = (h: number) => (h < 24 ? t("ai.hoursAgo", { n: h }) : t("ai.daysAgo", { n: Math.round(h / 24) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <span className="btn btn-primary w-full cursor-not-allowed opacity-60" title={t("ai.locked")}>
          <MessageSquarePlus className="size-4" /> {ta("newChat")}
        </span>
        <Link href="/demo/ai/faq" className="btn btn-secondary w-full">
          <MessageCircleQuestion className="size-4" /> {ta("faq.title")}
        </Link>
        <p className="px-1 text-xs text-muted">{ta("usage", { used: 3, limit: 20 })}</p>
        <nav className="space-y-1" aria-label={ta("history")}>
          {chats.map((c) => (
            <Link key={c.id} href={`/demo/ai?chat=${c.id}`} className={`block rounded-xl px-3 py-2 text-sm transition ${c.id === chat.id ? "bg-accent/15 font-semibold" : "hover:bg-surface-2/70"}`}>
              <span className="block truncate">{c.title}</span>
              <span className="block truncate text-[11px] text-muted">
                {c.game} · {ago(c.hoursAgo)}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      <section data-guide="demo-ai" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <GameCover name={chat.game} src={null} size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="page-title text-2xl sm:text-3xl">{chat.game}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <BookOpen className="size-4 shrink-0 text-accent" /> {ta("withRulebooks", { count: chat.rulebooks })}
            </p>
          </div>
        </div>

        <Link href={`/demo/ai/faq/${chat.gameId}`} className="card-hover flex items-center gap-3 rounded-2xl p-4">
          <MessageCircleQuestion className="size-6 shrink-0 text-accent" />
          <span className="flex-1">
            <span className="block font-semibold">{ta("faq.gameCard", { name: chat.game })}</span>
            <span className="text-xs text-muted">{ta("faq.gameCardHint", { count: faqCount })}</span>
          </span>
          <ChevronRight className="size-5 text-muted" />
        </Link>

        <div className="card card-pad space-y-5">
          {chat.turns.map((turn, i) => (
            <div key={i} className="space-y-3">
              <div className="flex justify-end gap-2">
                <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent/15 px-4 py-2.5 text-sm font-semibold">{turn.q}</p>
                <Meeple color={DEMO_ME.meepleColor} size={28} />
              </div>
              <div className="flex gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                  <Sparkles className="size-4" />
                </span>
                <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 text-sm leading-relaxed">
                  {turn.fromFaq && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-success">
                      <BadgeCheck className="size-3.5" /> {ta("faq.fromFaqVerified")}
                    </p>
                  )}
                  <p>{turn.a}</p>
                  <p className="flex flex-wrap gap-1.5">
                    {turn.pages.map((p) => (
                      <span key={p} className="chip chip-accent">
                        📖 {t("ai.page", { n: p })}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* asking is for members */}
          <div className="relative">
            <textarea disabled rows={2} className="textarea pointer-events-none opacity-40" placeholder={t("ai.placeholder")} />
            <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-surface/80 p-3 text-center text-sm backdrop-blur-sm">
              <Lock className="size-4 shrink-0 text-accent" />
              <span className="font-semibold">{t("ai.locked")}</span>
              <Link href="/register" className="btn btn-primary btn-sm">
                <UserPlus className="size-4" /> {t("banner.signUp")}
              </Link>
            </div>
          </div>
        </div>

        <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-muted">{t("ai.note")}</p>
      </section>
    </div>
  );
}

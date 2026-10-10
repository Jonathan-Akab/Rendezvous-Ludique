"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, BadgeCheck, BookOpen, Gift, ImagePlus, KeyRound, LoaderCircle, MessageCircleQuestion, Sparkles, Square, X } from "lucide-react";
import { ProviderSwitch, type Provider, type ProviderInfo } from "./ProviderSwitch";

const MAX_IMAGES = 3;

/** Shrinks a photo to at most 1568 px and re-encodes it as JPEG (small upload, and the format Claude and Gemini accept). */
async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("image");
  return new File([blob], file.name.replace(/.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

const KNOWN_ERRORS = ["imageError", "limit", "notConfigured", "refusal", "busy", "disabled", "rulebookRequired", "blocked", "budget", "freeUnavailable", "claudeUnavailable", "freeBusy", "freeError", "api", "noFaqMatch", "freeIncomplete", "ownUnavailable", "ownKeyInvalid", "ownKeyCredit"];
/** Errors meaning "the AI cannot answer right now" (the FAQ may still have). */
const AI_DOWN = ["limit", "notConfigured", "budget", "claudeUnavailable", "freeUnavailable", "disabled"];
import { Meeple } from "@/components/Meeple";
import { RulebookLink } from "@/modules/games/components/RulebookOverlay";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: { page: number; endPage: number; text: string; fileId?: string; title?: string }[];
  provider?: string | null;
  /** photos attached to a question (file ids) */
  images?: string[];
  /** set when the answer comes from the game's FAQ */
  faq?: { question: string; verified: boolean } | null;
};

export function AiChat({
  chatId,
  gameId,
  bookCount,
  fallbackFileId,
  initialMessages,
  meepleColor,
  disabledReason,
  aiUnavailable,
  providerInfo,
  initialProvider,
}: {
  chatId?: string;
  gameId?: string;
  /** how many rulebooks the AI reads for this game */
  bookCount: number;
  /** rulebook of older conversations, for citations saved without their rulebook */
  fallbackFileId?: string;
  initialMessages: ChatMessage[];
  meepleColor: string;
  disabledReason?: string;
  /** The AI can't answer right now, but questions can still be answered from the FAQ. */
  aiUnavailable?: string;
  providerInfo: ProviderInfo;
  initialProvider: Provider;
}) {
  const t = useTranslations("ai");
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChat, setCurrentChat] = useState(chatId);
  const [provider, setProvider] = useState<Provider>(
    initialProvider === "claude" && !providerInfo.claudeAvailable && providerInfo.freeAvailable ? "free" : initialProvider,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [attached, setAttached] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"faq" | Provider>("faq");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const suggestions = [t("suggest.explain"), t("suggest.turn"), t("suggest.win"), t("suggest.setup")];

  async function addImages(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - attached.length);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      for (const f of files) body.append("files", await shrinkImage(f));
      const res = await fetch("/api/ai/images", { method: "POST", body });
      if (!res.ok) throw new Error("imageError");
      const { ids } = (await res.json()) as { ids: string[] };
      setAttached((a) => [...a, ...ids.map((id) => ({ id, url: `/files/${id}` }))].slice(0, MAX_IMAGES));
    } catch {
      setError("imageError");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** `skipFaq`: the FAQ answer didn't help — ask the AI the same question. */
  async function ask(question: string, skipFaq = false) {
    const imageIds = skipFaq ? [] : attached.map((a) => a.id);
    const q = question.trim() || (imageIds.length ? t("imageDefault") : "");
    if (!q || busy || uploading) return;
    setError(null);
    setNotice(null);
    if (!skipFaq) {
      setInput("");
      setAttached([]);
    }
    setBusy(true);
    setStage(skipFaq ? provider : "faq");
    const assistantId = `a-${Date.now()}`;
    const assistant: ChatMessage = { id: assistantId, role: "assistant", content: "", citations: [] };
    setMessages((m) => (skipFaq ? [...m, assistant] : [...m, { id: `u-${Date.now()}`, role: "user", content: q, citations: [], images: imageIds }, assistant]));
    const update = (fn: (msg: ChatMessage) => ChatMessage) => setMessages((all) => all.map((m) => (m.id === assistantId ? fn(m) : m)));

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let newChatId = currentChat;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: currentChat, gameId, question: q, provider, skipFaq, imageIds }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "unknown");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "chat") {
            newChatId = ev.id;
            setCurrentChat(ev.id);
          } else if (ev.type === "provider") {
            update((m) => ({ ...m, provider: ev.provider }));
            if (ev.provider === "claude" || ev.provider === "free" || ev.provider === "own") setStage(ev.provider);
            if (ev.switched) setNotice(t(`switched.${ev.reason ?? "disabled"}`));
          } else if (ev.type === "faq") update((m) => ({ ...m, faq: { question: ev.question, verified: Boolean(ev.verified) } }));
          else if (ev.type === "text") update((m) => ({ ...m, content: m.content + ev.text }));
          else if (ev.type === "citation") update((m) => ({ ...m, citations: [...m.citations, { page: ev.page, endPage: ev.endPage, text: ev.text }] }));
          else if (ev.type === "error") setError(ev.code);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      // Drop the empty answer bubble when nothing came back.
      setMessages((all) => all.filter((m) => m.id !== assistantId || m.content));
      setBusy(false);
      abortRef.current = null;
      if (newChatId && newChatId !== chatId) {
        window.history.replaceState(null, "", `/ai?chat=${newChatId}`);
        router.refresh();
      }
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <ProviderSwitch value={provider} onChange={setProvider} info={providerInfo} />
      <p className="mt-2 flex flex-wrap items-center gap-1.5 px-2 text-xs text-muted">
        <MessageCircleQuestion className="size-3.5 text-accent" />
        {t("flow", {
          who: provider === "own" ? t("provider.own") : provider === "claude" ? t("provider.claudeSite", { site: providerInfo.siteName }) : t("provider.free", { name: providerInfo.freeName }),
          count: bookCount,
        })}
      </p>
      <div className="flex-1 space-y-5 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-accent to-accent-2 shadow-[0_10px_40px_-10px_var(--accent)]"
            >
              <Sparkles className="size-9 text-accent-ink" />
            </motion.div>
            <p className="max-w-md text-muted">{t("empty")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} disabled={!!disabledReason} className="chip px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <span className="mt-1 shrink-0">
                {m.role === "user" ? (
                  <Meeple color={meepleColor} size={28} />
                ) : (
                  <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2">
                    {m.provider === "faq" ? (
                      <MessageCircleQuestion className="size-4 text-accent-ink" />
                    ) : m.provider === "free" ? (
                      <Gift className="size-4 text-accent-ink" />
                    ) : m.provider === "own" ? (
                      <KeyRound className="size-4 text-accent-ink" />
                    ) : (
                      <Sparkles className="size-4 text-accent-ink" />
                    )}
                  </span>
                )}
              </span>
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                  m.role === "user" ? "rounded-tr-md bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent)_70%,var(--accent-2))] text-accent-ink" : "glass rounded-tl-md"
                }`}
              >
                {m.role === "assistant" && m.provider && m.provider !== "faq" && (
                  <ProviderBadge provider={m.provider} freeName={providerInfo.freeName} siteName={providerInfo.siteName} />
                )}
                {m.role === "assistant" && !m.content && busy ? (
                  <span className="flex items-center gap-2 py-1" aria-live="polite">
                    <span className="flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </span>
                    <span className="text-xs text-muted">
                      {stage === "faq"
                        ? t("stage.faq")
                        : t(bookCount ? "stage.reading" : "stage.general", {
                            who: stage === "own" ? t("provider.own") : stage === "claude" ? t("provider.claudeSite", { site: providerInfo.siteName }) : t("provider.free", { name: providerInfo.freeName }),
                            count: bookCount,
                          })}
                    </span>
                  </span>
                ) : m.role === "assistant" ? (
                  <div className="prose-chat text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    {m.images && m.images.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {m.images.map((id) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={id} src={`/files/${id}`} alt="" className="max-h-40 rounded-xl object-cover" />
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-line text-sm">{m.content}</p>
                  </>
                )}
                {m.role === "assistant" && m.provider === "faq" && m.content && (
                  <div className="mt-3 space-y-2 border-t border-line/50 pt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {m.faq?.verified ? <BadgeCheck className="size-3" /> : <MessageCircleQuestion className="size-3" />}
                      {m.faq?.verified ? t("faq.fromFaqVerified") : t("faq.fromFaq")}
                    </span>
                    {m.faq?.question && <p className="text-xs text-muted">{t("faq.matchedQuestion", { question: m.faq.question })}</p>}
                    {i === messages.length - 1 && !busy && !disabledReason && !aiUnavailable && messages[i - 1]?.role === "user" && (
                      <button type="button" onClick={() => ask(messages[i - 1].content, true)} className="btn btn-secondary btn-sm">
                        <Sparkles className="size-3.5" /> {t("faq.askAnyway")}
                      </button>
                    )}
                  </div>
                )}
                {m.citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/50 pt-2">
                    {/* one chip per page range, even when several passages come from it */}
                    {m.citations.filter((c, i, all) => all.findIndex((x) => x.page === c.page && x.endPage === c.endPage && x.fileId === c.fileId) === i).map((c, i) => {
                      const fileId = c.fileId ?? fallbackFileId;
                      const label = (
                        <>
                          <BookOpen className="size-3" />
                          {bookCount > 1 && c.title ? <span className="max-w-32 truncate">{c.title} ·</span> : null}
                          {c.endPage > c.page ? t("pages", { from: c.page, to: c.endPage }) : t("page", { page: c.page })}
                        </>
                      );
                      // Opens the rulebook on that page in an overlay; closing it returns to the chat.
                      return fileId ? (
                        <RulebookLink key={i} fileId={fileId} page={c.page} title={c.title} hint={c.text} className="chip gap-1 hover:border-accent hover:text-accent">
                          {label}
                        </RulebookLink>
                      ) : (
                        <span key={i} title={c.text} className="chip gap-1">
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {aiUnavailable && <p className="rounded-xl bg-[#f2b705]/15 px-3 py-2 text-sm">{t("faq.onlyFaqNotice", { reason: aiUnavailable })}</p>}
        {notice && <p className="rounded-xl bg-[#f2b705]/15 px-3 py-2 text-sm">{notice}</p>}
        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{t(`errors.${aiUnavailable && AI_DOWN.includes(error) ? "noFaqMatch" : KNOWN_ERRORS.includes(error) ? error : "unknown"}`)}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="glass sticky bottom-24 flex flex-wrap items-end gap-2 rounded-3xl p-2 lg:bottom-4"
      >
        {(attached.length > 0 || uploading) && (
          <div className="flex w-full flex-wrap gap-2 px-2 pt-1">
            {attached.map((a) => (
              <span key={a.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="size-16 rounded-xl object-cover" />
                <button type="button" onClick={() => setAttached((all) => all.filter((x) => x.id !== a.id))} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-surface-2 text-ink shadow" title={t("removeImage")}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {uploading && (
              <span className="grid size-16 place-items-center rounded-xl border border-dashed border-line">
                <LoaderCircle className="size-5 animate-spin text-muted" />
              </span>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!disabledReason || busy || uploading || attached.length >= MAX_IMAGES} className="btn btn-secondary size-11 rounded-2xl p-0" title={t("addImage")}>
          <ImagePlus className="size-5" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={1}
          placeholder={disabledReason ?? (aiUnavailable ? t("faq.onlyFaq") : t("placeholder"))}
          disabled={!!disabledReason}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted"
        />
        {busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-secondary size-11 rounded-2xl p-0" title={t("stop")}>
            <Square className="size-4" />
          </button>
        ) : (
          <button type="submit" disabled={(!input.trim() && !attached.length) || uploading || !!disabledReason} className="btn btn-primary size-11 rounded-2xl p-0" title={t("send")}>
            <ArrowUp className="size-5" />
          </button>
        )}
      </form>
    </div>
  );
}

/** Who wrote an answer: Claude (paid, precise) or the free option. Shown on every AI answer. */
function ProviderBadge({ provider, freeName, siteName }: { provider: string; freeName: string; siteName: string }) {
  const t = useTranslations("ai.provider");
  const free = provider === "free";
  const own = provider === "own";
  return (
    <span
      className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        free ? "bg-[#f2b705]/20 text-[#c78f1f]" : own ? "bg-[#1c5fbf]/15 text-[#3b82f6]" : "bg-accent/15 text-accent"
      }`}
    >
      {free ? <Gift className="size-3.5" /> : own ? <KeyRound className="size-3.5" /> : <Sparkles className="size-3.5" />}
      {free ? t("badgeFree", { name: freeName }) : own ? t("badgeOwn") : t("badgeClaude", { site: siteName })}
    </span>
  );
}

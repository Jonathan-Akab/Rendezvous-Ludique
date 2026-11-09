"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Bell, BellOff, Lock, MessagesSquare, Send } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { loadChatAction, postChatAction, setChatNotifyAction, type ChatState } from "../chat";

const REFRESH_MS = 8000;

/** The table's private chat: host and players going, until the day after the game. */
export function EventChat({ eventId, initial }: { eventId: string; initial: ChatState }) {
  const t = useTranslations("events.chat");
  const format = useFormatter();
  const [chat, setChat] = useState(initial);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const count = useRef(initial.messages.length);

  const refresh = useCallback(async () => {
    const next = await loadChatAction(eventId);
    if (next) setChat(next);
  }, [eventId]);

  // new messages show up while the page is open (paused when the tab is hidden)
  useEffect(() => {
    if (!chat.open) return;
    const id = setInterval(() => document.visibilityState === "visible" && void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [chat.open, refresh]);

  // keep the newest message in view
  useEffect(() => {
    if (chat.messages.length !== count.current) {
      count.current = chat.messages.length;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chat.messages.length]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, []);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    startSend(async () => {
      await postChatAction(eventId, body);
      await refresh();
    });
  };
  const toggleNotify = () => {
    const on = !chat.notify;
    setChat((c) => ({ ...c, notify: on }));
    void setChatNotifyAction(eventId, on);
  };

  if (!chat.open) {
    return (
      <section id="chat" className="card card-pad scroll-mt-24 space-y-2">
        <h2 className="section-title flex items-center gap-2">
          <MessagesSquare className="size-5 text-accent" /> {t("title")}
        </h2>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Lock className="size-4" /> {t("closed")}
        </p>
      </section>
    );
  }

  return (
    <section id="chat" className="card card-pad scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title mr-auto flex items-center gap-2">
          <MessagesSquare className="size-5 text-accent" /> {t("title")}
        </h2>
        <button
          type="button"
          onClick={toggleNotify}
          aria-pressed={chat.notify}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${chat.notify ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
        >
          {chat.notify ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          {chat.notify ? t("notifyOn") : t("notifyOff")}
        </button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Lock className="size-3.5" /> {t("private", { date: format.dateTime(new Date(chat.closesAt), { dateStyle: "medium" }) })}
      </p>

      <div ref={listRef} className="max-h-96 space-y-2 overflow-y-auto rounded-2xl bg-surface-2/40 p-3">
        {chat.messages.length === 0 && <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>}
        {chat.messages.map((m) => (
          <div key={m.id} className={`flex items-end gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
            <Meeple color={m.color} size={24} />
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "rounded-br-sm bg-accent/15" : "rounded-bl-sm bg-surface"}`}>
              {!m.mine && <p className="text-xs font-bold">{m.name}</p>}
              <p className="whitespace-pre-line break-words">{m.body}</p>
              <p className="mt-0.5 text-[10px] text-muted">{format.dateTime(new Date(m.at), { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        ))}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter goes to the next line
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={t("placeholder")}
          className="textarea min-h-0 flex-1 resize-none"
          aria-label={t("placeholder")}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()} title={t("send")}>
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}

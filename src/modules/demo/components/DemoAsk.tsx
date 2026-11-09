"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { MessageCircleQuestion, Send } from "lucide-react";
import { Popup } from "@/components/Popup";
import { askDemoAction } from "../actions";

// "Une question?": a floating button in the demo; the free AI answers questions about how the
// site works (and only that).

const OPEN_EVENT = "rl:demo-ask";
export function openDemoAsk() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function DemoAsk() {
  const t = useTranslations("demo.ask");
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: string; failed?: boolean }[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const ask = (q: string) => {
    const text = q.trim();
    if (text.length < 3 || pending) return;
    setQuestion("");
    start(async () => {
      const res = await askDemoAction(text);
      const a = res.answer ?? t(`errors.${res.error ?? "unavailable"}`);
      setAnswers((list) => [...list, { q: text, a, failed: !res.answer }]);
    });
  };
  const examples = [t("ex1"), t("ex2"), t("ex3")];

  return (
    <>
      <button
        type="button"
        data-guide="demo-ask"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[55] inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-bold text-accent-ink shadow-[0_12px_30px_-10px_var(--accent)] transition hover:-translate-y-0.5"
      >
        <MessageCircleQuestion className="size-5" /> {t("button")}
      </button>
      <Popup open={open} onClose={() => setOpen(false)} title={t("title")} icon={<MessageCircleQuestion className="size-5" />} closeLabel={t("close")}>
        <p className="text-sm text-muted">{t("lead")}</p>
        {answers.length > 0 && (
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {answers.map((x, i) => (
              <li key={i} className="space-y-1.5 text-sm">
                <p className="ml-8 rounded-2xl rounded-br-sm bg-accent/15 px-3 py-2 font-semibold">{x.q}</p>
                <p className={`mr-8 whitespace-pre-line rounded-2xl rounded-bl-sm px-3 py-2 ${x.failed ? "bg-danger/10 text-danger" : "bg-surface-2"}`}>{x.a}</p>
              </li>
            ))}
          </ul>
        )}
        {pending && <p className="animate-pulse text-sm text-muted">{t("thinking")}</p>}
        {answers.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button key={ex} type="button" onClick={() => ask(ex)} className="rounded-full border border-line bg-surface-2/60 px-3 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-ink">
                {ex}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={400} className="input" placeholder={t("placeholder")} autoFocus />
          <button type="submit" disabled={pending || question.trim().length < 3} className="btn btn-primary" title={t("send")}>
            <Send className="size-4" />
          </button>
        </form>
        <p className="text-[11px] text-muted">{t("scope")}</p>
      </Popup>
    </>
  );
}

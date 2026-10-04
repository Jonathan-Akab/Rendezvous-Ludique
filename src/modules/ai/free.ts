import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";

// The free option: any OpenAI-compatible chat endpoint (by default Google Gemini's free
// tier; Groq, OpenRouter or a local Ollama also work). These models don't read PDFs
// natively, so the rulebook text is extracted once, page by page, and the pages most
// relevant to the question are sent along with it.

export function freeConfigured(baseUrl: string) {
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|ollama)(:\d+)?/i.test(baseUrl);
  return Boolean(baseUrl) && (isLocal || Boolean(process.env.FREE_AI_API_KEY));
}

/** Rulebook text, one string per page (extracted on first use, then cached in the DB). */
export async function rulebookPages(rulebook: { id: string; textContent: string | null; file: { storageKey: string } }) {
  if (rulebook.textContent) return JSON.parse(rulebook.textContent) as string[];
  const data = await readStored(rulebook.file.storageKey);
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = text.map((p) => p.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim());
  await db.rulebook.update({ where: { id: rulebook.id }, data: { textContent: JSON.stringify(pages) } });
  return pages;
}

const STOP = new Set("le la les un une des de du et ou en au aux est que qui quoi comment pour pas on je tu il elle the a an of to and or is are how what when do does can in on for with".split(" "));
const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? [];

/** Keeps the whole rulebook when it fits, otherwise the pages that best match the question. */
export function selectPages(pages: string[], question: string, maxChars: number) {
  const total = pages.reduce((n, p) => n + p.length, 0);
  const all = pages.map((text, i) => ({ page: i + 1, text }));
  if (total <= maxChars) return all;
  const q = new Set(words(question));
  const scored = all.map((p) => {
    const w = words(p.text);
    const hits = w.filter((x) => q.has(x)).length;
    return { ...p, score: hits / Math.sqrt(w.length + 10) + (p.page <= 2 ? 0.5 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: typeof all = [];
  let used = 0;
  for (const p of scored) {
    if (used + p.text.length > maxChars) continue;
    picked.push({ page: p.page, text: p.text });
    used += p.text.length;
  }
  return picked.sort((a, b) => a.page - b.page);
}

export type FreeMessage = { role: "system" | "user" | "assistant"; content: string };

/** Streams an answer from the OpenAI-compatible endpoint; yields text chunks. */
export async function* streamFree(opts: { baseUrl: string; model: string; messages: FreeMessage[]; signal?: AbortSignal }) {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.FREE_AI_API_KEY ? { Authorization: `Bearer ${process.env.FREE_AI_API_KEY}` } : {}),
    },
    body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true, temperature: 0.2 }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new FreeProviderError(res.status, detail.slice(0, 300));
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
      const data = line.trim().replace(/^data:\s*/, "");
      if (!data || data === "[DONE]" || !line.trim().startsWith("data:")) continue;
      try {
        const chunk = JSON.parse(data);
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield text as string;
      } catch {
        /* ignore keep-alive or partial lines */
      }
    }
  }
}

export class FreeProviderError extends Error {
  constructor(
    public status: number,
    detail: string,
  ) {
    super(`Free AI provider error ${status}: ${detail}`);
  }
}

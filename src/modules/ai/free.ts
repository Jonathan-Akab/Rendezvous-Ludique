import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";
import { getModule } from "@/lib/modules";

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

/** Keeps every page when they fit, otherwise the pages that best match the question. */
export function selectPages<T extends { page: number; text: string }>(all: T[], question: string, maxChars: number): T[] {
  const total = all.reduce((n, p) => n + p.text.length, 0);
  if (total <= maxChars) return all;
  const q = new Set(words(question));
  const scored = all.map((p, index) => {
    const w = words(p.text);
    const hits = w.filter((x) => q.has(x)).length;
    return { p, index, score: hits / Math.sqrt(w.length + 10) + (p.page <= 2 ? 0.5 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  let used = 0;
  for (const s of scored) {
    if (used + s.p.text.length > maxChars) continue;
    picked.push(s);
    used += s.p.text.length;
  }
  // back in reading order: rulebook by rulebook, page by page
  return picked.sort((a, b) => a.index - b.index).map((s) => s.p);
}

export type FreeMessage = { role: "system" | "user" | "assistant"; content: string };

/** Streams an answer from the OpenAI-compatible endpoint; yields text chunks. */
export async function* streamFree(opts: { baseUrl: string; model: string; messages: FreeMessage[]; signal?: AbortSignal }) {
  const send = () =>
    fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FREE_AI_API_KEY ? { Authorization: `Bearer ${process.env.FREE_AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true, temperature: 0.2 }),
      signal: opts.signal,
    });
  // Free tiers are often briefly overloaded (429/503): wait a moment and try again.
  let res = await send();
  for (const delay of [1500, 4000]) {
    if (res.status !== 429 && res.status !== 503) break;
    await res.body?.cancel().catch(() => {});
    await new Promise((r) => setTimeout(r, delay));
    res = await send();
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new FreeProviderError(res.status, detail.slice(0, 300));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finish: string | null = null;
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
        finish = chunk.choices?.[0]?.finish_reason ?? finish;
        if (text) yield text as string;
      } catch {
        /* ignore keep-alive or partial lines */
      }
    }
  }
  // Overloaded free tiers sometimes close the stream mid-answer without finishing it.
  if (finish !== "stop") throw new FreeProviderError(finish === "length" ? 413 : 502, `incomplete answer (finish: ${finish})`);
}

export class FreeProviderError extends Error {
  constructor(
    public status: number,
    detail: string,
  ) {
    super(`Free AI provider error ${status}: ${detail}`);
  }
}

/**
 * One complete (non-streamed) answer from the free provider, e.g. JSON data, for the site's
 * background tasks (completing games, checking pictures, reading photos). They use the
 * "task" model — by default a lite one with a larger free quota than the chat's model.
 * `content` may mix text and images (OpenAI format). Retries briefly when overloaded,
 * but not when the day's free quota is used up.
 */
export async function completeFree(content: string | unknown[], { json = true } = {}) {
  const mod = await getModule("ai");
  const s = mod.settings;
  if (!mod.enabled || !s.freeEnabled || !freeConfigured(String(s.freeBaseUrl))) throw new FreeProviderError(503, "free AI not configured");
  // Google: no "thinking" for these simple tasks — answers in seconds instead of tens.
  let noThinking = /generativelanguage\.googleapis\.com/.test(String(s.freeBaseUrl));
  const call = (withFormat: boolean) =>
    fetch(`${String(s.freeBaseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FREE_AI_API_KEY ? { Authorization: `Bearer ${process.env.FREE_AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: String(s.freeTaskModel || s.freeModel),
        temperature: 0,
        ...(noThinking ? { reasoning_effort: "none" } : {}),
        ...(withFormat ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "user", content }],
      }),
    });
  let res = await call(json);
  if (res.status === 400 && noThinking) {
    noThinking = false; // this model can't turn thinking off
    res = await call(json);
  }
  if (res.status === 400 && json) res = await call(false); // provider without response_format
  for (const delay of [2000, 5000, 5000]) {
    if (res.status !== 429 && res.status !== 503) break;
    const body = await res.clone().text().catch(() => "");
    // A per-minute limit says when to come back ("retry in 12s"): wait that long.
    // A daily quota (or a long wait) stops here.
    const wait = Number(body.match(/retry in ([\d.]+)s/i)?.[1] ?? body.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? NaN);
    if (/quota/i.test(body) && !(wait <= 65)) throw new FreeQuotaError(body.slice(0, 300));
    await new Promise((r) => setTimeout(r, Number.isFinite(wait) ? (wait + 1) * 1000 : delay));
    res = await call(json);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429 && /quota/i.test(body)) throw new FreeQuotaError(body.slice(0, 300));
    throw new FreeProviderError(res.status, body.slice(0, 300));
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Parses the JSON object inside a model answer (tolerates text or ``` fences around it). */
export function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** The free provider's quota for the day (or the minute) is used up. */
export class FreeQuotaError extends FreeProviderError {
  constructor(detail: string) {
    super(429, `quota exceeded: ${detail}`);
  }
}

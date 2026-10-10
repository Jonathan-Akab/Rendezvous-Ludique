import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { getClient } from "@/modules/ai/service";
import { getOwnKey } from "@/modules/ai/ownKey";
import { claudeCostUsd } from "@/modules/ai/pricing";
import { getAiStatus } from "@/modules/ai/policy";
import type { ImageResult } from "./images";

// Deeper box picture search: Claude searches the web for the game's box art, then we read the
// picture each page advertises (its og:image). The member still picks the one that is right.

/** A cheap model is enough to run a few searches (priced in ai/pricing.ts). */
const SEARCH_MODEL = "claude-haiku-4-5";
/** Anthropic charges $10 per 1,000 web searches on top of the tokens. */
const SEARCH_COST_USD = 0.01;
const MAX_SEARCHES = 3;
const MAX_PAGES = 8;
const UA = "RendezvousLudique/1.0 (board game community site)";

// ── fetching pages found on the web, without letting them point us at our own network ──

const privateIp = (ip: string) =>
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) ||
  /^(::1?$|fc|fd|fe80)/i.test(ip) ||
  /^::ffff:/i.test(ip);

async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (isIP(host)) return privateIp(host) ? null : u;
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length && addrs.every((a) => !privateIp(a.address)) ? u : null;
  } catch {
    return null;
  }
}

/** GET with a time limit and a size limit, following at most 3 redirects (each one re-checked). */
async function fetchPublicPage(raw: string, maxBytes = 400_000): Promise<{ url: string; type: string; text: string } | null> {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await publicUrl(current);
    if (!u) return null;
    try {
      const res = await fetch(u, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "manual", signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next) return null;
        current = new URL(next, u).toString();
        continue;
      }
      if (!res.ok || !res.body) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!/html/i.test(type)) return { url: u.toString(), type, text: "" };
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < maxBytes) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
      await reader.cancel().catch(() => {});
      return { url: u.toString(), type, text: Buffer.concat(chunks).toString("utf8") };
    } catch {
      return null;
    }
  }
  return null;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** The picture a page advertises (og:image, twitter:image, image_src) and its title. */
function pagePicture(html: string, baseUrl: string): { image: string; title: string } | null {
  const meta = (names: string[]) => {
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
      const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (key && content && names.includes(key)) return decode(content);
    }
    return null;
  };
  const link = /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  const raw = meta(["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) ?? (link ? decode(link) : null);
  if (!raw) return null;
  let image: string;
  try {
    image = new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
  const title = meta(["og:title", "twitter:title"]) ?? /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
  return { image, title: decode(title).trim().slice(0, 120) };
}

const looksLikePicture = (u: string) => /\.(jpe?g|png|webp)(\?|$)/i.test(u);

// ── asking Claude to search ──

/** Which Claude may be used for this member: the site's (within budgets) or their own key. */
async function pickClaude(userId: string): Promise<{ client: Anthropic; provider: "claude" | "own"; model: string } | null> {
  const mod = await getModule("ai");
  if (!mod.enabled) return null;
  const status = await getAiStatus(userId, mod);
  if (status.access === "NONE") return null;
  if (status.preferred === "own" && status.own.available) {
    const own = await getOwnKey(userId);
    if (own) return { client: new Anthropic({ apiKey: own.apiKey }), provider: "own", model: SEARCH_MODEL };
  }
  if (status.claude.available) return { client: getClient(), provider: "claude", model: SEARCH_MODEL };
  if (status.own.available) {
    const own = await getOwnKey(userId);
    if (own) return { client: new Anthropic({ apiKey: own.apiKey }), provider: "own", model: SEARCH_MODEL };
  }
  return null;
}

/**
 * Runs one question through Claude with web search. Returns its text answer and the pages the search
 * found, or null when no Claude is available to this member (AI off, budget used up…).
 * The cost is recorded like the other AI calls: the site's budgets ("claude") or the member's own spending ("own").
 */
export async function claudeWebSearch(userId: string, prompt: string, purpose: string): Promise<{ answer: string; results: { url: string; title: string }[] } | null> {
  const claude = await pickClaude(userId);
  if (!claude) return null;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  const urls: { url: string; title: string }[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;
  let model: string = claude.model;
  let answer = "";

  try {
    for (let turn = 0; turn < 3; turn++) {
      const res = await claude.client.messages.create({
        model: claude.model,
        max_tokens: 2000,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
      });
      model = res.model;
      inputTokens += res.usage.input_tokens;
      outputTokens += res.usage.output_tokens;
      searches += res.usage.server_tool_use?.web_search_requests ?? 0;
      for (const block of res.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) if (r.type === "web_search_result") urls.push({ url: r.url, title: r.title });
        }
        if (block.type === "text") answer += block.text;
      }
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content });
    }
  } catch (e) {
    console.error(`[${purpose}] Claude web search failed:`, e);
  }

  if (inputTokens || outputTokens) {
    await db.aiUsage
      .create({
        data: {
          userId,
          purpose,
          provider: claude.provider,
          model,
          inputTokens,
          outputTokens,
          costUsd: claudeCostUsd(model, { input_tokens: inputTokens, output_tokens: outputTokens }) + searches * SEARCH_COST_USD,
        },
      })
      .catch((e) => console.error(`[${purpose}] usage not recorded:`, e));
  }
  return { answer, results: urls };
}

/** Web search with Claude: the box art of the game, from pages that show it (BGG, publisher, shops…). */
export async function claudeWebImages(name: string, userId: string): Promise<ImageResult[]> {
  const prompt = `Find the official box cover picture of the board game "${name}". Search the web (BoardGameGeek, the publisher's site, board game shops). Prefer the current edition's front cover.
When done, answer with JSON only, listing the web pages that show this exact game's box, best first: {"pages":[{"url":"https://…","title":"…"}]}. Include direct picture links (.jpg/.png/.webp) too if you saw any. Only the game "${name}" — not a similar title, not an expansion unless that is what was asked.`;
  const search = await claudeWebSearch(userId, prompt, "image");
  if (!search) return [];
  const { answer, results: urls } = search;

  // What Claude chose goes first, then the other pages the search returned.
  const chosen: { url: string; title: string }[] = [];
  try {
    const parsed = JSON.parse(answer.slice(answer.indexOf("{"), answer.lastIndexOf("}") + 1)) as { pages?: { url?: unknown; title?: unknown }[] };
    for (const p of parsed.pages ?? []) if (typeof p.url === "string") chosen.push({ url: p.url, title: typeof p.title === "string" ? p.title : "" });
  } catch {
    /* no usable JSON: the search results alone will do */
  }
  const seenPage = new Set<string>();
  const pages = [...chosen, ...urls].filter((p) => !seenPage.has(p.url) && seenPage.add(p.url)).slice(0, MAX_PAGES);

  const found = await Promise.all(
    pages.map(async (p): Promise<ImageResult | null> => {
      let host = "";
      try {
        host = new URL(p.url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
      if (looksLikePicture(p.url)) return (await publicUrl(p.url)) ? { url: p.url, thumb: p.url, title: p.title || name, source: host } : null;
      const page = await fetchPublicPage(p.url);
      if (!page?.text) return null;
      const pic = pagePicture(page.text, page.url);
      if (!pic || !(await publicUrl(pic.image))) return null;
      return { url: pic.image, thumb: pic.image, title: pic.title || p.title || name, source: host };
    }),
  );
  const seen = new Set<string>();
  return found.filter((r): r is ImageResult => r !== null && !seen.has(r.url) && Boolean(seen.add(r.url)));
}

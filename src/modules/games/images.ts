import "server-only";
import { getModule } from "@/lib/modules";
import { bggConfigured, bggImages } from "@/lib/bgg";
import { textSimilarity } from "@/lib/similarity";
import { foldText } from "@/lib/fold";

// Picture suggestions for a game box, from free sources only. The member picks one;
// we store only its link (the image usually belongs to the publisher, so we don't copy it).
//   bgg       — BoardGameGeek (free app token: BGG_API_TOKEN), most accurate for board games
//   wikimedia — Wikipedia articles' main picture (often the box) + Wikimedia Commons (free, no key)
//   auto      — BGG when a token is set, otherwise Wikipedia/Wikimedia

export type ImageResult = { url: string; thumb: string; title: string; source: string };

async function wikimedia(query: string): Promise<ImageResult[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${query} board game`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "400",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "RendezvousLudique/1.0 (board game community site)" },
    cache: "no-store",
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return []; // throttled or down
  const data = (await res.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: { url: string; thumburl?: string }[] }> } };
  const results = Object.values(data.query?.pages ?? {})
    .map((p) => p.imageinfo?.[0] && { url: p.imageinfo[0].url, thumb: p.imageinfo[0].thumburl ?? p.imageinfo[0].url, title: p.title.replace(/^File:/, ""), source: "Wikimedia Commons" })
    .filter((x): x is ImageResult => Boolean(x) && /\.(jpe?g|png|webp)$/i.test((x as ImageResult).url));
  // Commons is general-purpose: show pictures that look like the game first.
  const name = query.toLowerCase();
  const gameLike = (t: string) => /game|jeu|board|box|bo[iî]te|dice|card|tile|meeple|spiel/i.test(t);
  const score = (r: ImageResult) => (foldText(r.title).includes(foldText(name)) ? 2 : 0) + (gameLike(r.title) ? 1 : 0);
  return results.filter((r) => score(r) > 0).sort((a, b) => score(b) - score(a));
}

/**
 * The picture at the top of the game's Wikipedia article (often its box), English then
 * French Wikipedia. Free, no key; only articles whose title looks like the game count.
 */
async function wikipedia(query: string): Promise<ImageResult[]> {
  const out: ImageResult[] = [];
  for (const [lang, suffix] of [["en", "board game"], ["fr", "jeu de société"]] as const) {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${query} ${suffix}`,
      gsrlimit: "4",
      prop: "pageimages",
      piprop: "thumbnail|original",
      pithumbsize: "400",
      pilicense: "any",
      format: "json",
      origin: "*",
    });
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
        headers: { "User-Agent": "RendezvousLudique/1.0 (board game community site)" },
        cache: "no-store",
      });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) continue;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { title: string; index: number; thumbnail?: { source: string }; original?: { source: string } }> };
      };
      const clean = (u: string) => u.replace(/\?utm_[^#]*$/, "");
      for (const p of Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index)) {
        const title = p.title.replace(/\s*\((jeu|game|board game|jeu de société)\)$/i, "");
        if (!p.original || textSimilarity(title, query) < 0.6) continue;
        out.push({ url: clean(p.original.source), thumb: clean(p.thumbnail?.source ?? p.original.source), title: p.title, source: `Wikipedia (${lang})` });
      }
    } catch {
      /* try the next language */
    }
  }
  return out;
}

export function imageProvider(setting: string) {
  if (setting === "none") return null;
  if (setting === "bgg" || setting === "auto") return bggConfigured() ? "bgg" : setting === "auto" ? "wikimedia" : null;
  return "wikimedia";
}

export async function searchGameImages(query: string): Promise<{ provider: string | null; results: ImageResult[] }> {
  const mod = await getModule("games");
  const provider = imageProvider(String(mod.settings.imageSearch ?? "auto"));
  try {
    if (provider === "bgg") {
      const results = await bggImages(query);
      // fall back to Wikipedia/Wikimedia when BGG has nothing
      return results.length ? { provider, results } : { provider: "wikimedia", results: await freeWikiImages(query) };
    }
    if (provider === "wikimedia") return { provider, results: await freeWikiImages(query) };
  } catch (e) {
    console.error("[images] search failed:", e);
  }
  return { provider, results: [] };
}

/** Wikipedia's article picture first (usually the box), then Wikimedia Commons. */
async function freeWikiImages(query: string) {
  const [wp, commons] = await Promise.all([wikipedia(query), wikimedia(query)]);
  const seen = new Set<string>();
  return [...wp, ...commons].filter((r) => !seen.has(r.url) && seen.add(r.url));
}

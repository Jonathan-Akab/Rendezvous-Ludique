import "server-only";
import { XMLParser } from "fast-xml-parser";

// BoardGameGeek XML API2. Since July 2025 every request needs a registered
// application token (https://boardgamegeek.com/applications) → BGG_API_TOKEN.
// Used only for a member's own collection import and to find box pictures.

const BASE = "https://boardgamegeek.com/xmlapi2";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", isArray: (name) => name === "item" || name === "name" });

export function bggConfigured() {
  return Boolean(process.env.BGG_API_TOKEN);
}

export class BggError extends Error {
  constructor(public code: "notConfigured" | "notFound" | "busy" | "failed") {
    super(code);
  }
}

async function bggGet(path: string, retries = 6): Promise<Record<string, unknown>> {
  if (!bggConfigured()) throw new BggError("notConfigured");
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${process.env.BGG_API_TOKEN}` }, cache: "no-store" });
    // 202: BGG is preparing the collection — ask again shortly.
    if (res.status === 202 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new BggError("notConfigured");
    if (!res.ok) throw new BggError("failed");
    return parser.parse(await res.text());
  }
  throw new BggError("busy");
}

type XmlItem = Record<string, unknown> & { name?: unknown; status?: Record<string, string>; stats?: Record<string, string> };
const text = (v: unknown) => (v == null ? null : typeof v === "object" ? String((v as { "#text"?: unknown })["#text"] ?? "") : String(v));
const num = (v: unknown) => {
  const n = Number(text(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Box pictures for a game name, from BGG's search + thing endpoints. */
export async function bggImages(query: string, limit = 6) {
  const search = await bggGet(`/search?query=${encodeURIComponent(query)}&type=boardgame`, 1);
  const ids = (((search.items as { item?: XmlItem[] })?.item ?? []) as XmlItem[]).slice(0, limit).map((i) => i.id);
  if (!ids.length) return [];
  const things = await bggGet(`/thing?id=${ids.join(",")}`, 1);
  return ((((things.items as { item?: XmlItem[] })?.item ?? []) as XmlItem[]))
    .map((it) => {
      const names = (it.name as Record<string, string>[]) ?? [];
      const primary = names.find((n) => n.type === "primary") ?? names[0];
      const image = text(it.image);
      return image ? { url: image, thumb: text(it.thumbnail) ?? image, title: primary?.value ?? query, source: "BoardGameGeek" } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

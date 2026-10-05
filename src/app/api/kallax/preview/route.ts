import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { enrichAvailable, previewItems } from "@/modules/games/enrich";
import { FreeProviderError, FreeQuotaError } from "@/modules/ai/free";

// Before an import: the free AI fills in what it can for each found game (details, a
// verified box picture, whether it's an expansion). Nothing is saved — the member then
// validates or skips each game.
//   POST { items: [{ key, name, gameId? }…] } → { results: PreviewResult[] }

const bodySchema = z.object({
  items: z.array(z.object({ key: z.string().max(200), name: z.string().trim().min(1).max(150), gameId: z.string().nullable().optional() })).min(1).max(6),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await enrichAvailable())) return Response.json({ error: "unavailable" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    return Response.json({ results: await previewItems(parsed.data.items, user.locale) });
  } catch (e) {
    if (e instanceof FreeQuotaError) return Response.json({ error: "quota" }, { status: 429 });
    if (e instanceof FreeProviderError) return Response.json({ error: e.status === 429 || e.status === 503 ? "busy" : "failed" }, { status: 502 });
    console.error("[preview] failed:", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

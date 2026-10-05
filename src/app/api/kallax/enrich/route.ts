import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isLibraryMember } from "@/modules/kallax/service";
import { enrichAvailable, enrichKallaxGames } from "@/modules/games/enrich";
import { FreeProviderError, FreeQuotaError } from "@/modules/ai/free";
import { revalidatePath } from "next/cache";

// Completes games just added to a Kallax (details + box picture) with the free AI.
// Called by the browser right after an add or an import, a few games at a time.
//   POST { ids: [kallaxGameId…] } → { results: [{ id, name, filled, image }] }

const bodySchema = z.object({ ids: z.array(z.string()).min(1).max(6) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await enrichAvailable())) return Response.json({ error: "unavailable" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  // Only games of Kallax the member shares.
  const kgs = await db.kallaxGame.findMany({ where: { id: { in: parsed.data.ids } }, select: { id: true, libraryId: true } });
  const allowed: string[] = [];
  for (const kg of kgs) if (await isLibraryMember(kg.libraryId, user.id)) allowed.push(kg.id);
  if (!allowed.length) return Response.json({ results: [] });

  try {
    const results = await enrichKallaxGames(allowed, user.locale);
    revalidatePath("/kallax", "layout");
    revalidatePath("/games", "layout");
    return Response.json({ results });
  } catch (e) {
    if (e instanceof FreeQuotaError) return Response.json({ error: "quota" }, { status: 429 });
    if (e instanceof FreeProviderError) return Response.json({ error: e.status === 429 || e.status === 503 ? "busy" : "failed" }, { status: 502 });
    console.error("[enrich] failed:", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

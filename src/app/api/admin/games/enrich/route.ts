import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { enrichAvailable, enrichGames } from "@/modules/games/enrich";
import { FreeProviderError, FreeQuotaError } from "@/modules/ai/free";

// Staff with the "Ludothèque" right: completes Ludothèque entries with the free AI,
// a few at a time (empty fields only, a verified picture, expansions linked).
//   POST { ids: [gameId…] } → { results: [{ id, name, filled, image, expansionOf }] }

const bodySchema = z.object({ ids: z.array(z.string()).min(1).max(6) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "games")) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!(await enrichAvailable())) return Response.json({ error: "unavailable" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    const results = await enrichGames(parsed.data.ids, user.locale);
    await audit(user.id, "admin.games.enrich", results.map((r) => r.name).join(", ").slice(0, 200));
    revalidatePath("/games", "layout");
    revalidatePath("/admin/games");
    return Response.json({ results });
  } catch (e) {
    if (e instanceof FreeQuotaError) return Response.json({ error: "quota" }, { status: 429 });
    if (e instanceof FreeProviderError) return Response.json({ error: "busy" }, { status: 502 });
    console.error("[ludo enrich] failed:", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

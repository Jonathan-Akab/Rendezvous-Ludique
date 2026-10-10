import { getCurrentUser } from "@/lib/auth/session";
import { searchGameImages } from "@/modules/games/images";
import { claudeWebImages } from "@/modules/games/webImages";

// Box picture suggestions: GET /api/images/search?q=Azul
//   (default)  free sources, instant
//   &ai=1      Claude searches the web for the box art — slower, counts in the AI budgets
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ results: [] }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ provider: null, results: [] });
  if (params.get("ai") === "1") return Response.json({ provider: "claude", results: await claudeWebImages(q, user.id) });
  return Response.json(await searchGameImages(q));
}

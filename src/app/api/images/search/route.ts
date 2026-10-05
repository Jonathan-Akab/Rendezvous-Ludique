import { getCurrentUser } from "@/lib/auth/session";
import { searchGameImages } from "@/modules/games/images";

// Box picture suggestions: GET /api/images/search?q=Azul
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ results: [] }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ provider: null, results: [] });
  return Response.json(await searchGameImages(q));
}

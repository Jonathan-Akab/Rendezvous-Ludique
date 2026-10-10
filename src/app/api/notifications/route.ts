import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

// The bell: GET /api/notifications → { unread, items } (the latest 20 of the signed-in member).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ unread: 0, items: [] }, { status: 401 });
  const [unread, rows] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return Response.json(
    {
      unread,
      items: rows.map((n) => {
        let params: Record<string, string> = {};
        try {
          params = JSON.parse(n.params);
        } catch {
          /* keep empty */
        }
        return { id: n.id, type: n.type, params, path: n.path, read: n.readAt != null, createdAt: n.createdAt.toISOString() };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

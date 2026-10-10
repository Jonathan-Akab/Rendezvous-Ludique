import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { readStored } from "@/lib/storage";

// Serves uploaded files. Images (covers, bazar photos, theme pictures) are public — they
// appear on public profiles and the login page; rulebooks are for signed-in members only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  const viewer = file.kind === "RULEBOOK" || file.kind === "AI_IMAGE" ? await getCurrentUser() : null;
  if ((file.kind === "RULEBOOK" || file.kind === "AI_IMAGE") && !viewer) return new Response("Unauthorized", { status: 401 });
  // Photos sent to the rules AI are private to the member who sent them.
  if (file.kind === "AI_IMAGE" && viewer && file.ownerId !== viewer.id && viewer.role !== "ADMIN") return new Response("Not found", { status: 404 });

  try {
    const data = await readStored(file.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${new URL(req.url).searchParams.has("download") ? "attachment" : "inline"}; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": file.kind === "RULEBOOK" || file.kind === "AI_IMAGE" ? "private, max-age=3600" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

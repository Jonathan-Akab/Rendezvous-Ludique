import { getCurrentUser } from "@/lib/auth/session";
import { getModule } from "@/lib/modules";
import { saveUpload, UploadError } from "@/lib/storage";

// Photos attached to a rules question: POST multipart `files` (at most MAX_IMAGES) → { ids }.
const MAX_IMAGES = 3;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const mod = await getModule("ai");
  if (!mod.enabled) return Response.json({ error: "disabled" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File).slice(0, MAX_IMAGES);
  if (!files.length) return Response.json({ error: "empty" }, { status: 400 });
  try {
    const ids: string[] = [];
    for (const f of files) ids.push((await saveUpload(f, "AI_IMAGE", user.id)).id);
    return Response.json({ ids });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.code }, { status: 400 });
    throw e;
  }
}

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getModule } from "@/lib/modules";
import { matchAll } from "@/modules/kallax/importer";
import Anthropic from "@anthropic-ai/sdk";
import { OwnKeyMissingError, recognizeGames } from "@/modules/kallax/recognize";
import { FreeProviderError, FreeQuotaError } from "@/modules/ai/free";
import { getAiStatus, resolveProvider } from "@/modules/ai/policy";

// Builds an import preview for the kallax (nothing is saved here):
//   POST JSON      { source: "list", names: [...] } → a pasted list of names
//   POST multipart mode=box|shelf, provider=claude|free|own, images[] → titles read from photos
//        (same choices, rights and budgets as the rules AI)
// Every result is matched against our own game database.

const jsonSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("list"), names: z.array(z.string().trim().min(1).max(150)).min(1).max(500) }),
]);

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await getModule("kallax")).enabled) return Response.json({ error: "disabled" }, { status: 404 });

  const type = req.headers.get("content-type") ?? "";
  let provider = "free";
  try {
    if (type.includes("multipart/form-data")) {
      const fd = await req.formData();
      const ai = await getModule("ai");
      if (!ai.enabled) return Response.json({ error: "visionUnavailable" }, { status: 503 });
      const requested = fd.get("provider") === "free" ? "free" : fd.get("provider") === "own" ? "own" : "claude";
      const decision = resolveProvider(await getAiStatus(user.id, ai), requested, Boolean(ai.settings.autoFallbackToFree));
      if ("error" in decision) return Response.json({ error: `ai_${decision.error}` }, { status: 403 });
      provider = decision.provider;
      const mode = fd.get("mode") === "box" ? "box" : "shelf";
      const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
      if (!files.length) return Response.json({ error: "noImage" }, { status: 400 });
      if (files.some((f) => !f.type.startsWith("image/") || f.size > MAX_IMAGE_BYTES)) return Response.json({ error: "badImage" }, { status: 400 });
      const images = await Promise.all(files.map(async (f) => ({ mediaType: f.type, base64: Buffer.from(await f.arrayBuffer()).toString("base64") })));
      const found = await recognizeGames(images, mode, decision.provider, user.id);
      return Response.json({
        items: await matchAll(found.map((g) => ({ name: g.name, confidence: g.confidence }))),
        provider: decision.provider,
        switched: decision.switched,
      });
    }

    const parsed = jsonSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
    const names = Array.from(new Set(parsed.data.names.map((n) => n.replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, "").trim()) /* bullets or "1." numbering, not "7 Wonders" */.filter(Boolean)));
    return Response.json({ items: await matchAll(names.map((name) => ({ name }))) });
  } catch (e) {
    if (e instanceof FreeQuotaError) return Response.json({ error: "visionQuota" }, { status: 429 });
    if (e instanceof FreeProviderError) return Response.json({ error: e.status === 429 || e.status === 503 ? "visionBusy" : "visionError" }, { status: 502 });
    if (e instanceof OwnKeyMissingError) return Response.json({ error: "ai_ownUnavailable" }, { status: 403 });
    if (e instanceof Anthropic.APIError) {
      const own = provider === "own";
      const code =
        own && (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
          ? "ai_ownKeyInvalid"
          : own && /credit balance/i.test(e.message)
            ? "ai_ownKeyCredit"
            : e instanceof Anthropic.RateLimitError
              ? "visionBusy"
              : "visionError";
      console.error("[kallax import] Claude failed:", e.status, e.message);
      return Response.json({ error: code }, { status: 502 });
    }
    console.error("[kallax import] failed:", e);
    return Response.json({ error: "unknown" }, { status: 500 });
  }
}

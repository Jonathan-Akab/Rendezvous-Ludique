import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { completeFree, freeConfigured } from "@/modules/ai/free";
import { getClient } from "@/modules/ai/service";
import { getOwnKey } from "@/modules/ai/ownKey";
import { claudeCostUsd } from "@/modules/ai/pricing";
import type { Provider } from "@/modules/ai/policy";

// Reads game titles from photos (one box, or a whole shelf). Same three choices as the
// rules AI: the site's Claude (counted in the AI budgets), the free option, or the
// member's personal Claude (their own key and credits).

export type Recognized = { name: string; confidence: "high" | "medium" | "low" };

const resultSchema = z.object({
  games: z
    .array(z.object({ name: z.string().min(1).max(150), confidence: z.enum(["high", "medium", "low"]).catch("medium") }))
    .max(300),
});

const PROMPT = {
  box: `This photo shows a board game box (front, back or side). Identify the game. Read the title printed on the box and return it as commonly written (keep the edition's language if visible). If several games are visible, list each one.`,
  shelf: `These photos show a shelf or a pile of board games. List every board game you can identify, reading the titles on the box fronts and spines. Return each distinct game once, with its title as commonly written (keep the edition's language if visible). Ignore expansions only if they are clearly part of a base game box; list visible expansions separately. Skip anything that isn't a board game. Use confidence "low" when the title is partly hidden or you're guessing from artwork.`,
};
const FORMAT = `Answer with JSON only, in this shape: {"games":[{"name":"Azul","confidence":"high"}]}. If you see no board game, answer {"games":[]}.`;

type Image = { mediaType: string; base64: string };

/** The member's personal Claude has no key or can't be read. */
export class OwnKeyMissingError extends Error {}

export async function freeVisionAvailable() {
  const mod = await getModule("ai");
  return mod.enabled && Boolean(mod.settings.freeEnabled) && freeConfigured(String(mod.settings.freeBaseUrl));
}

/** Titles found in the photos, with the provider that read them. */
export async function recognizeGames(images: Image[], mode: "box" | "shelf", provider: Provider, userId: string) {
  const raw = provider === "free" ? await readWithFree(images, mode) : await readWithClaude(images, mode, provider, userId);
  return parseGames(raw);
}

async function readWithClaude(images: Image[], mode: "box" | "shelf", provider: Provider, userId: string) {
  const own = provider === "own" ? await getOwnKey(userId) : null;
  if (provider === "own" && !own) throw new OwnKeyMissingError();
  const mod = await getModule("ai");
  const model = own?.model ?? (String(mod.settings.model) || "claude-opus-5-5");
  const client = own ? new Anthropic({ apiKey: own.apiKey }) : getClient();
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: img.base64 },
          })),
          { type: "text" as const, text: `${PROMPT[mode]}\n\n${FORMAT}` },
        ],
      },
    ],
  });
  // Counted like rules questions: in the site's budgets ("claude") or on the member's own spending ("own").
  await db.aiUsage.create({
    data: {
      userId,
      purpose: "photo",
      provider,
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      costUsd: claudeCostUsd(message.model, message.usage),
    },
  });
  return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function readWithFree(images: Image[], mode: "box" | "shelf") {
  return completeFree([
    { type: "text", text: `${PROMPT[mode]}\n\n${FORMAT}` },
    ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } })),
  ]);
}

function parseGames(raw: string): Recognized[] {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const parsed = resultSchema.parse(JSON.parse(json));
    const seen = new Set<string>();
    return parsed.games.filter((g) => {
      const key = g.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

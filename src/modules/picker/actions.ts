"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

const presetsSchema = z
  .array(z.object({ name: z.string().trim().min(1).max(40), filters: z.record(z.string(), z.unknown()) }))
  .max(12);

/** Saves the member's own filter sets (the whole list, after an add or a delete). */
export async function savePickerPresetsAction(presets: unknown) {
  const user = await requireUser();
  const parsed = presetsSchema.safeParse(presets);
  if (!parsed.success) return { ok: false };
  const json = JSON.stringify(parsed.data);
  if (json.length > 8000) return { ok: false };
  await db.user.update({ where: { id: user.id }, data: { pickerPresets: json } });
  return { ok: true };
}

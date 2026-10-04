import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MODULES, defaultSettings, getManifest, type ModuleKey } from "@/modules/registry";

export type ModuleState = {
  key: ModuleKey;
  enabled: boolean;
  sortOrder: number;
  settings: Record<string, string | number | boolean>;
};

/** Current state of every module, merged with manifest defaults. Cached per request. */
export const getModuleStates = cache(async (): Promise<Record<ModuleKey, ModuleState>> => {
  const rows = await db.moduleConfig.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out = {} as Record<ModuleKey, ModuleState>;
  for (const [index, m] of MODULES.entries()) {
    const row = byKey.get(m.key);
    let stored: Record<string, unknown> = {};
    try {
      stored = row ? JSON.parse(row.settings) : {};
    } catch {
      stored = {};
    }
    out[m.key] = {
      key: m.key,
      enabled: m.core ? true : (row?.enabled ?? true),
      sortOrder: row?.sortOrder || (index + 1) * 10,
      settings: { ...defaultSettings(m.key), ...(stored as ModuleState["settings"]) },
    };
  }
  return out;
});

export async function getModule(key: ModuleKey) {
  return (await getModuleStates())[key];
}

export async function isModuleEnabled(key: ModuleKey) {
  return (await getModule(key)).enabled;
}

/** Call at the top of a module page: 404s when an admin has disabled the module. */
export async function requireModule(key: ModuleKey) {
  const mod = await getModule(key);
  if (!mod.enabled) notFound();
  return mod;
}

export async function saveModule(key: ModuleKey, enabled: boolean, settings: ModuleState["settings"]) {
  const manifest = getManifest(key);
  await db.moduleConfig.upsert({
    where: { key },
    create: { key, enabled: manifest.core ? true : enabled, settings: JSON.stringify(settings) },
    update: { enabled: manifest.core ? true : enabled, settings: JSON.stringify(settings) },
  });
}

/** Modules in the admin-defined menu order. */
export async function getOrderedModules() {
  const states = await getModuleStates();
  return [...MODULES].sort((a, b) => states[a.key].sortOrder - states[b.key].sortOrder);
}

/** Moves a module one step up or down in the default menu order. */
export async function moveModule(key: ModuleKey, direction: -1 | 1) {
  const ordered = await getOrderedModules();
  const i = ordered.findIndex((m) => m.key === key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ordered.length) return;
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  for (const [index, m] of ordered.entries()) {
    await db.moduleConfig.upsert({
      where: { key: m.key },
      create: { key: m.key, sortOrder: (index + 1) * 10 },
      update: { sortOrder: (index + 1) * 10 },
    });
  }
}
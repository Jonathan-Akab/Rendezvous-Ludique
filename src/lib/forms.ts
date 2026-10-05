// Helpers for reading FormData in server actions.

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string) {
  return str(fd, key) || null;
}

export function optInt(fd: FormData, key: string) {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function optFloat(fd: FormData, key: string) {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function bool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, unknown> } | undefined;

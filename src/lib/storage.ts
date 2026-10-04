import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// Uploaded files live on disk under UPLOAD_DIR (a Docker volume in production);
// the database keeps their metadata (StoredFile).

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage");

export const FILE_LIMITS = {
  COVER: { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] },
  RULEBOOK: { maxBytes: 30 * 1024 * 1024, types: ["application/pdf"] },
  IMAGE: { maxBytes: 8 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
} as const;

export type FileKind = keyof typeof FILE_LIMITS;

export class UploadError extends Error {
  constructor(public code: "type" | "size" | "empty") {
    super(code);
  }
}

export async function saveUpload(file: File, kind: FileKind, ownerId: string | null) {
  const limits = FILE_LIMITS[kind];
  if (!file || file.size === 0) throw new UploadError("empty");
  if (!(limits.types as readonly string[]).includes(file.type)) throw new UploadError("type");
  if (file.size > limits.maxBytes) throw new UploadError("size");

  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 6);
  const storageKey = `${kind.toLowerCase()}/${randomBytes(16).toString("hex")}${ext}`;
  await mkdir(/*turbopackIgnore: true*/ path.join(ROOT, kind.toLowerCase()), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(ROOT, storageKey), Buffer.from(await file.arrayBuffer()));

  return db.storedFile.create({
    data: { ownerId, kind, fileName: file.name.slice(0, 200), mimeType: file.type, size: file.size, storageKey },
  });
}

export function readStored(storageKey: string) {
  const full = path.join(ROOT, storageKey);
  if (!full.startsWith(ROOT)) throw new Error("Invalid key");
  return readFile(/*turbopackIgnore: true*/ full);
}

export async function deleteStored(fileId: string) {
  const f = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!f) return;
  await db.storedFile.delete({ where: { id: fileId } });
  await unlink(/*turbopackIgnore: true*/ path.join(ROOT, f.storageKey)).catch(() => {});
}

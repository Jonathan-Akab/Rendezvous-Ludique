import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encrypts secrets stored in the database (members' own API keys) with AES-256-GCM.
// The key comes from APP_SECRET, which lives only in the server's environment, so a
// leaked database alone doesn't reveal the secrets.

function key() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECRET is missing or shorter than 32 characters");
  return createHash("sha256").update(secret).digest();
}

/** True when APP_SECRET is set, i.e. secrets can be stored. */
export function secretsAvailable() {
  return (process.env.APP_SECRET?.length ?? 0) >= 32;
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

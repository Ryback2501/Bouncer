import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "../config";

// Application-layer encryption for PII at rest (e.g. User.email). AES-256-GCM with a random IV
// per value; the stored form is `enc:v1:<base64(iv(12) | tag(16) | ciphertext)>`.
//
// Rollout-safe: decryptField passes through any value that is NOT in the `enc:v1:` format, so
// legacy plaintext rows keep working until the backfill encrypts them. With no key configured
// (local dev/test), encryptField is a no-op so values stay plaintext.

const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer | null {
  if (!config.ENCRYPTION_KEY) return null;
  return Buffer.from(config.ENCRYPTION_KEY, "base64");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // no key (dev) → store plaintext
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LEN });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptField(value: string): string {
  if (!isEncrypted(value)) return value; // legacy plaintext → passthrough
  const key = getKey();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is required to read encrypted data");
  }
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  // Node's GCM accepts tags as short as 4 bytes, so a truncated value would be checked against a
  // 4-byte tag — forgeable in 2^32 tries by anyone who can write to the DB (B-12). Require the full
  // 16-byte tag, both here and via authTagLength.
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error("Encrypted value is too short");
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

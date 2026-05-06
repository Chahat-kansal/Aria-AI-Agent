import "server-only";

import crypto from "crypto";
import { redactSensitive as redactThroughRedaction } from "@/lib/security/redaction";

const PREFIX = "ariaenc:v1";
const ALGORITHM = "aes-256-gcm";

function normalizeKey(raw: string) {
  const trimmed = raw.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length === 32) return decoded;
  throw new Error("APP_FIELD_ENCRYPTION_KEY must be 32 bytes base64 or 64 hex chars.");
}

export function getFieldEncryptionKey() {
  const raw = process.env.APP_FIELD_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    return normalizeKey(raw);
  } catch {
    return null;
  }
}

export function isEncryptionConfigured() {
  return Boolean(getFieldEncryptionKey());
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

function encryptBytes(bytes: Buffer) {
  const key = getFieldEncryptionKey();
  if (!key) throw new Error("APP_FIELD_ENCRYPTION_KEY is not configured for sensitive encryption.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

function decryptBytes(value: string) {
  const key = getFieldEncryptionKey();
  if (!key) throw new Error("APP_FIELD_ENCRYPTION_KEY is not configured for sensitive decryption.");
  const [, , ivRaw, tagRaw, dataRaw] = value.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]);
}

export function encryptString(value: string) {
  if (!value) return value;
  if (isEncrypted(value)) return value;
  return encryptBytes(Buffer.from(value, "utf8"));
}

export function decryptString(value: string) {
  if (!value || !isEncrypted(value)) return value;
  return decryptBytes(value).toString("utf8");
}

export function encryptJson(value: unknown) {
  return encryptString(JSON.stringify(value ?? null));
}

export function decryptJson<T>(value: string): T {
  return JSON.parse(decryptString(value)) as T;
}

export function encryptBuffer(buffer: Buffer) {
  return encryptBytes(buffer);
}

export function decryptBuffer(value: string) {
  return decryptBytes(value);
}

export function decryptOrReturn<T>(value: T): T {
  if (typeof value === "string" && isEncrypted(value)) {
    return decryptString(value) as T;
  }
  return value;
}

export function maybeDecryptJson<T>(value: unknown): T {
  if (typeof value === "string" && isEncrypted(value)) {
    return decryptJson<T>(value);
  }
  return value as T;
}

export function redactSensitive(value: unknown) {
  return redactThroughRedaction(value);
}

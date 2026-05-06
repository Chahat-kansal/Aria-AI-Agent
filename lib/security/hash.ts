import crypto from "crypto";

export function sha256Hex(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function shortHashPreview(value: string | Buffer, length = 12) {
  return sha256Hex(value).slice(0, Math.max(6, length));
}

export function hashPortalToken(token: string) {
  return sha256Hex(token);
}

export function hashNormalizedEmail(email: string) {
  return sha256Hex(email.trim().toLowerCase());
}

export function hashDocumentChecksum(buffer: Buffer) {
  return sha256Hex(buffer);
}

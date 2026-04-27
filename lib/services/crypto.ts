import crypto from "crypto";

const algorithm = "aes-256-gcm";

function getKey() {
  const secret = process.env.APP_FIELD_ENCRYPTION_KEY;
  if (!secret) throw new Error("APP_FIELD_ENCRYPTION_KEY is missing");

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(value: string | null | undefined) {
  if (!value) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64")
  ].join(":");
}

export function decryptText(value: string | null | undefined) {
  if (!value || !value.includes(":")) return value;

  const [ivRaw, tagRaw, encryptedRaw] = value.split(":");

  const decipher = crypto.createDecipheriv(
    algorithm,
    getKey(),
    Buffer.from(ivRaw, "base64")
  );

  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final()
  ]).toString("utf8");
}
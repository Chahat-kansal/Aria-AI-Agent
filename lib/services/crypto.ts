import { decryptString, encryptString } from "@/lib/security/encryption";

export function encryptText(value: string | null | undefined) {
  if (!value) return value;
  return encryptString(value);
}

export function decryptText(value: string | null | undefined) {
  if (!value) return value;
  return decryptString(value);
}

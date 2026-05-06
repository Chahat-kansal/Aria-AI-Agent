import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getStorageConfigStatus, getUploadLimits } from "@/lib/services/runtime-config";
import { encryptBuffer, isEncryptionConfigured } from "@/lib/security/encryption";

export type StoredUpload = {
  storageKey: string;
  provider: string;
  contentHash: string;
  fileSize: number;
  data?: Buffer;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const blockedExtensions = [".exe", ".bat", ".cmd", ".js", ".msi", ".com", ".ps1", ".sh", ".php", ".html", ".svg"];

function assertSafeUpload(fileName: string, mimeType?: string) {
  const lower = fileName.toLowerCase();
  if (blockedExtensions.some((extension) => lower.endsWith(extension))) {
    throw new Error("This file type is not allowed for secure migration document storage.");
  }
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Upload PDF, image, text, or Word document evidence only.`);
  }
}

export async function prepareMatterDocumentUpload(input: {
  matterId: string;
  fileName: string;
  bytes: Buffer;
  mimeType?: string;
}) {
  const status = getStorageConfigStatus();
  if (!status.configured) {
    throw new Error(`Storage is not configured for provider ${status.provider}. Missing ${status.missing.join(", ")}.`);
  }
  if (process.env.NODE_ENV === "production" && !isEncryptionConfigured()) {
    throw new Error("Sensitive document upload is blocked until APP_FIELD_ENCRYPTION_KEY is configured correctly.");
  }
  const limits = getUploadLimits();
  if (input.bytes.length > limits.maxBytes) {
    throw new Error(`File is too large. Maximum upload size is ${limits.maxMb} MB.`);
  }
  assertSafeUpload(input.fileName, input.mimeType);

  const contentHash = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const provider = status.provider;
  const storageKey = `matters/${input.matterId}/${contentHash.slice(0, 16)}-${safeFileName(input.fileName)}`;
  const storedData = provider === "database" || provider === "local"
    ? Buffer.from(encryptBuffer(input.bytes), "utf8")
    : undefined;

  return {
    storageKey,
    provider,
    contentHash,
    fileSize: input.bytes.length,
    data: storedData
  } satisfies StoredUpload;
}

export async function persistDocumentStorageObject(input: {
  documentId: string;
  upload: StoredUpload;
}) {
  await prisma.documentStorageObject.upsert({
    where: { documentId: input.documentId },
    update: {
      provider: input.upload.provider,
      storageKey: input.upload.storageKey,
      data: input.upload.data
    },
    create: {
      documentId: input.documentId,
      provider: input.upload.provider,
      storageKey: input.upload.storageKey,
      data: input.upload.data
    }
  });
}

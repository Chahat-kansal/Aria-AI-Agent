import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getStorageConfigStatus, getUploadLimits } from "@/lib/services/runtime-config";
import { encryptBuffer, isEncryptionConfigured } from "@/lib/security/encryption";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";

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

const blockedExtensions = [".exe", ".bat", ".cmd", ".js", ".msi", ".com", ".ps1", ".sh", ".php", ".html", ".svg"];

function assertSafeUpload(fileName: string, mimeType: string | undefined, allowedMimeTypes: Set<string>) {
  const lower = fileName.toLowerCase();
  if (blockedExtensions.some((extension) => lower.endsWith(extension))) {
    throw new Error("This file type is not allowed for secure migration document storage.");
  }
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Upload PDF, image, text, or Word document evidence only.`);
  }
}

export async function prepareMatterDocumentUpload(input: {
  workspaceId: string;
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
  const settings = await getWorkspaceOperationalSettingsView(input.workspaceId);
  const effectiveMaxBytes = Math.min(limits.maxBytes, settings.documentMaxUploadBytes || limits.maxBytes);
  if (input.bytes.length > effectiveMaxBytes) {
    throw new Error(`File is too large. Maximum upload size is ${Math.round(effectiveMaxBytes / (1024 * 1024))} MB.`);
  }
  assertSafeUpload(input.fileName, input.mimeType, new Set(settings.documentAllowedMimeTypes));

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

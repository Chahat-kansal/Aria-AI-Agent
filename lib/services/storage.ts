import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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

export async function prepareMatterDocumentUpload(input: {
  matterId: string;
  fileName: string;
  bytes: Buffer;
}) {
  const contentHash = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const provider = process.env.STORAGE_PROVIDER || "database";
  const storageKey = `matters/${input.matterId}/${contentHash.slice(0, 16)}-${safeFileName(input.fileName)}`;

  return {
    storageKey,
    provider,
    contentHash,
    fileSize: input.bytes.length,
    data: provider === "database" || provider === "local" ? input.bytes : undefined
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

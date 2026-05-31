import { Prisma } from "@prisma/client";
import type { CloudDriveExportType, CloudDriveManifestItem } from "@/lib/providers/cloud-drive-provider";
import { prisma } from "@/lib/prisma";
import { decryptBuffer, isEncrypted } from "@/lib/security/encryption";
import { getAcknowledgementRecordView } from "@/lib/services/esign/acknowledgement-record";
import { sanitizeCloudDriveName } from "@/lib/services/cloud-drive/cloud-drive-redaction";
import { getCloudDriveCategoryFolder, sanitizeMatterFolderStructure } from "@/lib/services/cloud-drive/cloud-drive-safety";

export type MatterExportBuiltItem = CloudDriveManifestItem & {
  bytes: Buffer;
};

export type MatterExportBuildResult = {
  items: MatterExportBuiltItem[];
  skippedReasons: string[];
  matter: {
    id: string;
    workspaceId: string;
    title: string;
    visaSubclass: string;
    client: { id: string; firstName: string; lastName: string; clientReference: string | null };
    matterReference: string | null;
  };
};

export const SECURE_STORAGE_RETRIEVAL_MODE = "storage_object_bytes_decrypt_if_needed";

const matterExportSelect = Prisma.validator<Prisma.MatterFindFirstArgs>()({
  include: {
    client: true,
    assignedToUser: true,
    documents: { include: { storageObject: true }, orderBy: { createdAt: "asc" } },
    generatedDocuments: { orderBy: { createdAt: "asc" } },
    invoices: { orderBy: { createdAt: "asc" } },
    acknowledgementRequests: { orderBy: { createdAt: "asc" } }
  }
});

function readStoredDocumentBytes(data: Buffer | Uint8Array | null | undefined) {
  if (!data) return null;
  const raw = Buffer.from(data);
  const asString = raw.toString("utf8");
  return isEncrypted(asString) ? decryptBuffer(asString) : raw;
}

function rootFolderForMatter(input: {
  client: { id: string; firstName: string; lastName: string; clientReference: string | null };
  matterReference: string | null;
  matterId: string;
}) {
  const folders = sanitizeMatterFolderStructure({
    clientReference: input.client.clientReference,
    clientName: `${input.client.firstName} ${input.client.lastName}`,
    clientId: input.client.id,
    matterReference: input.matterReference,
    matterId: input.matterId
  });
  return `${folders.clientFolder}/${folders.matterFolder}`;
}

function invoiceSummaryHtml(invoice: {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  issueDate: Date;
  dueDate: Date;
  status: string;
  totalCents: number;
  currency: string;
}) {
  return [
    `<html><body>`,
    `<h1>Invoice ${invoice.invoiceNumber}</h1>`,
    `<p>Client: ${invoice.clientName}</p>`,
    `<p>Email: ${invoice.clientEmail || "Not provided"}</p>`,
    `<p>Issue date: ${invoice.issueDate.toISOString()}</p>`,
    `<p>Due date: ${invoice.dueDate.toISOString()}</p>`,
    `<p>Status: ${invoice.status}</p>`,
    `<p>Total cents: ${invoice.totalCents}</p>`,
    `<p>Currency: ${invoice.currency}</p>`,
    `</body></html>`
  ].join("");
}

export async function buildMatterExportItems(input: {
  workspaceId: string;
  matterId: string;
  exportType: CloudDriveExportType;
  selectedDocumentIds?: string[] | null;
  invoiceId?: string | null;
  acknowledgementRequestId?: string | null;
}) {
  const matter = await prisma.matter.findFirst({
    ...matterExportSelect,
    where: { id: input.matterId, workspaceId: input.workspaceId }
  });
  if (!matter) {
    throw new Error("Matter not found for this workspace.");
  }

  const root = rootFolderForMatter({
    client: matter.client,
    matterReference: matter.matterReference,
    matterId: matter.id
  });
  const items: MatterExportBuiltItem[] = [];
  const skippedReasons: string[] = [];

  const addManifest = () => {
    items.push({
      path: `${root}/00 Export Notes/read-first.txt`,
      category: "00 Export Notes",
      fileName: "read-first.txt",
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength("Exported through Aria secure server-side retrieval."),
      sourceEntityType: "manifest",
      sourceEntityId: matter.id,
      bytes: Buffer.from("Exported through Aria secure server-side retrieval. Sensitive documents should only be exported by authorised users.", "utf8")
    });
  };

  addManifest();

  const documents = input.selectedDocumentIds?.length
    ? matter.documents.filter((document) => input.selectedDocumentIds?.includes(document.id))
    : matter.documents;

  if (input.exportType === "matter_folder" || input.exportType === "selected_documents") {
    for (const document of documents) {
      const bytes = readStoredDocumentBytes(document.storageObject?.data);
      if (!bytes) {
        skippedReasons.push(`Skipped ${sanitizeCloudDriveName(document.fileName)} because secure file bytes were not available.`);
        continue;
      }
      const folder = getCloudDriveCategoryFolder(document.category);
      const fileName = sanitizeCloudDriveName(document.fileName, "document");
      items.push({
        path: `${root}/${folder}/${fileName}`,
        category: folder,
        fileName,
        mimeType: document.mimeType || "application/octet-stream",
        sizeBytes: bytes.length,
        sourceEntityType: "document",
        sourceEntityId: document.id,
        bytes
      });
    }
  }

  if (input.exportType === "matter_folder" || input.exportType === "draft_pack") {
    for (const generated of matter.generatedDocuments) {
      const fileName = sanitizeCloudDriveName(`${generated.title}.txt`, "draft.txt");
      const bytes = Buffer.from(generated.content, "utf8");
      items.push({
        path: `${root}/07 Drafts/${fileName}`,
        category: "07 Drafts",
        fileName,
        mimeType: "text/plain",
        sizeBytes: bytes.length,
        sourceEntityType: "generated_document",
        sourceEntityId: generated.id,
        bytes
      });
    }
    if (!matter.generatedDocuments.length) {
      skippedReasons.push("No generated draft pack records were available for this matter.");
    }
  }

  if (input.exportType === "matter_folder" || input.exportType === "invoice") {
    const invoices = input.invoiceId ? matter.invoices.filter((invoice) => invoice.id === input.invoiceId) : matter.invoices;
    for (const invoice of invoices) {
      const fileName = sanitizeCloudDriveName(`${invoice.invoiceNumber}.html`, "invoice.html");
      const bytes = Buffer.from(invoiceSummaryHtml(invoice), "utf8");
      items.push({
        path: `${root}/10 Invoices/${fileName}`,
        category: "10 Invoices",
        fileName,
        mimeType: "text/html",
        sizeBytes: bytes.length,
        sourceEntityType: "invoice",
        sourceEntityId: invoice.id,
        bytes
      });
    }
    if (!invoices.length) {
      skippedReasons.push("No invoice record was available for export.");
    }
  }

  if (input.exportType === "matter_folder" || input.exportType === "acknowledgement") {
    const requests = input.acknowledgementRequestId
      ? matter.acknowledgementRequests.filter((request) => request.id === input.acknowledgementRequestId)
      : matter.acknowledgementRequests;
    let added = false;
    for (const request of requests) {
      const record = await getAcknowledgementRecordView(request.id);
      if (!record) {
        skippedReasons.push(`Acknowledgement record for ${sanitizeCloudDriveName(request.title, "acknowledgement")} is not available.`);
        continue;
      }
      const fileName = sanitizeCloudDriveName(record.fileName, "acknowledgement.txt");
      const bytes = Buffer.from(record.content, "utf8");
      items.push({
        path: `${root}/08 Confirmations/${fileName}`,
        category: "08 Confirmations",
        fileName,
        mimeType: record.mimeType,
        sizeBytes: bytes.length,
        sourceEntityType: "acknowledgement",
        sourceEntityId: request.id,
        bytes
      });
      added = true;
    }
    if (!added) {
      skippedReasons.push("No acknowledgement record was available for export.");
    }
  }

  return {
    items,
    skippedReasons,
    matter: {
      id: matter.id,
      workspaceId: matter.workspaceId,
      title: matter.title,
      visaSubclass: matter.visaSubclass,
      matterReference: matter.matterReference,
      client: {
        id: matter.client.id,
        firstName: matter.client.firstName,
        lastName: matter.client.lastName,
        clientReference: matter.client.clientReference
      }
    }
  } satisfies MatterExportBuildResult;
}

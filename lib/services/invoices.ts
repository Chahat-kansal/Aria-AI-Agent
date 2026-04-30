import crypto from "crypto";
import { InvoiceAssetKind, InvoiceStatus, Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceTotals, formatCurrency, normalizeInvoiceLineItems, type InvoiceLineItemDraft as InvoiceLineItemInput } from "@/lib/invoice-calculations";
import { extractReadableText } from "@/lib/services/document-extraction";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { getAiConfigStatus, getStorageConfigStatus, getUploadLimits } from "@/lib/services/runtime-config";
import { canAccessMatter, hasFirmWideAccess, hasPermission, hasTeamOversight, scopedClientWhere, scopedMatterWhere } from "@/lib/services/roles";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export function detectInvoiceTemplateFields(extractedText: string | null | undefined) {
  const text = extractedText || "";
  const lowered = text.toLowerCase();
  const fields = {
    clientName: /client|bill to|invoice to/.test(lowered),
    invoiceNumber: /invoice number|invoice no|inv no/.test(lowered),
    issueDate: /issue date|invoice date/.test(lowered),
    dueDate: /due date/.test(lowered),
    lineItems: /description|qty|quantity|unit price|amount/.test(lowered),
    subtotal: /subtotal/.test(lowered),
    gst: /\bgst\b|tax/.test(lowered),
    total: /total due|total/.test(lowered),
    paymentInstructions: /bank|payment|bsb|account/.test(lowered),
    signature: /authorised|signature/.test(lowered)
  };

  return Object.entries(fields)
    .filter(([, present]) => present)
    .map(([key]) => key);
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export async function prepareInvoiceAssetUpload(input: {
  workspaceId: string;
  kind: InvoiceAssetKind;
  fileName: string;
  bytes: Buffer;
}) {
  const status = getStorageConfigStatus();
  if (!status.configured) {
    throw new Error(`Storage is not configured for provider ${status.provider}. Missing ${status.missing.join(", ")}.`);
  }
  const limits = getUploadLimits();
  if (input.bytes.length > limits.maxBytes) {
    throw new Error(`File is too large. Maximum upload size is ${limits.maxMb} MB.`);
  }

  const contentHash = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const provider = status.provider;
  const storageKey = `invoices/${input.workspaceId}/${input.kind.toLowerCase()}/${contentHash.slice(0, 16)}-${safeFileName(input.fileName)}`;

  return {
    storageKey,
    provider,
    contentHash,
    fileSize: input.bytes.length,
    data: provider === "database" || provider === "local" ? input.bytes : undefined
  };
}

export async function createInvoiceAsset(input: {
  workspaceId: string;
  kind: InvoiceAssetKind;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  extractedText?: string | null;
  detectedFieldsJson?: Prisma.InputJsonValue;
  invoiceId?: string | null;
}) {
  const upload = await prepareInvoiceAssetUpload({
    workspaceId: input.workspaceId,
    kind: input.kind,
    fileName: input.fileName,
    bytes: input.bytes
  });

  return prisma.invoiceAsset.create({
    data: {
      workspaceId: input.workspaceId,
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey: upload.storageKey,
      contentHash: upload.contentHash,
      fileSize: upload.fileSize,
      data: upload.data,
      extractedText: input.extractedText ?? null,
      detectedFieldsJson: input.detectedFieldsJson ?? Prisma.JsonNull,
      invoiceId: input.invoiceId ?? null
    }
  });
}

export function scopedInvoiceWhere(user: ScopedUser): Prisma.InvoiceWhereInput {
  if (hasFirmWideAccess(user)) return { workspaceId: user.workspaceId };
  if (hasTeamOversight(user)) {
    return {
      workspaceId: user.workspaceId,
      OR: [
        { createdByUserId: user.id },
        { matter: { OR: [{ assignedToUserId: user.id }, { assignedToUser: { supervisorId: user.id } }] } },
        { client: { OR: [{ assignedToUserId: user.id }, { assignedToUser: { supervisorId: user.id } }] } }
      ]
    };
  }
  return {
    workspaceId: user.workspaceId,
    OR: [
      { createdByUserId: user.id },
      { matter: { assignedToUserId: user.id } },
      { client: { assignedToUserId: user.id } }
    ]
  };
}

export async function getInvoiceByIdForUser(workspaceId: string, invoiceId: string, user: ScopedUser) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId, ...scopedInvoiceWhere(user) },
    include: {
      client: true,
      matter: { include: { client: true, assignedToUser: true } },
      createdByUser: true,
      template: { include: { asset: true } },
      branding: { include: { logoAsset: true, signatureAsset: true } },
      assets: true
    }
  });
}

export async function getInvoiceSetupData(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      invoiceBranding: { include: { logoAsset: true, signatureAsset: true } },
      invoiceServices: { where: { active: true }, orderBy: { serviceName: "asc" } },
      invoiceTemplates: { include: { asset: true }, orderBy: { createdAt: "desc" } }
    }
  });
}

export async function getInvoiceWorkspaceReferences(workspaceId: string, user: ScopedUser) {
  const [clients, matters, setup] = await Promise.all([
    prisma.client.findMany({
      where: scopedClientWhere(user),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        currentVisaStatus: true,
        assignedToUserId: true
      }
    }),
    prisma.matter.findMany({
      where: scopedMatterWhere(user),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        visaSubclass: true,
        visaStream: true,
        client: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    }),
    getInvoiceSetupData(workspaceId)
  ]);

  return {
    clients,
    matters,
    branding: setup?.invoiceBranding ?? null,
    services: setup?.invoiceServices ?? [],
    templates: setup?.invoiceTemplates ?? []
  };
}

export async function nextInvoiceNumber(workspaceId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { workspaceId } });
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function upsertInvoiceBranding(input: {
  workspaceId: string;
  businessName: string;
  legalName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  website?: string | null;
  abnAcn?: string | null;
  paymentInstructions?: string | null;
  bankDetails?: string | null;
  defaultCurrency: string;
  defaultGstRateBps: number;
  defaultDueDays: number;
  logoAssetId?: string | null;
  signatureAssetId?: string | null;
}) {
  return prisma.invoiceBranding.upsert({
    where: { workspaceId: input.workspaceId },
    update: {
      businessName: input.businessName,
      legalName: input.legalName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
      website: input.website ?? null,
      abnAcn: input.abnAcn ?? null,
      paymentInstructions: input.paymentInstructions ?? null,
      bankDetails: input.bankDetails ?? null,
      defaultCurrency: input.defaultCurrency,
      defaultGstRateBps: input.defaultGstRateBps,
      defaultDueDays: input.defaultDueDays,
      logoAssetId: input.logoAssetId ?? undefined,
      signatureAssetId: input.signatureAssetId ?? undefined
    },
    create: {
      workspaceId: input.workspaceId,
      businessName: input.businessName,
      legalName: input.legalName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
      website: input.website ?? null,
      abnAcn: input.abnAcn ?? null,
      paymentInstructions: input.paymentInstructions ?? null,
      bankDetails: input.bankDetails ?? null,
      defaultCurrency: input.defaultCurrency,
      defaultGstRateBps: input.defaultGstRateBps,
      defaultDueDays: input.defaultDueDays,
      logoAssetId: input.logoAssetId ?? null,
      signatureAssetId: input.signatureAssetId ?? null
    }
  });
}

async function assertInvoiceReferences(input: {
  workspaceId: string;
  user: ScopedUser;
  invoiceId?: string;
  clientId?: string | null;
  matterId?: string | null;
  templateId?: string | null;
  brandingId?: string | null;
}) {
  const [existingInvoice, client, matter, template, branding] = await Promise.all([
    input.invoiceId
      ? prisma.invoice.findFirst({
          where: {
            id: input.invoiceId,
            workspaceId: input.workspaceId,
            ...scopedInvoiceWhere(input.user)
          },
          select: { id: true }
        })
      : null,
    input.clientId
      ? prisma.client.findFirst({
          where: { id: input.clientId, ...scopedClientWhere(input.user) },
          select: { id: true }
        })
      : null,
    input.matterId
      ? prisma.matter.findFirst({
          where: { id: input.matterId, ...scopedMatterWhere(input.user) },
          select: { id: true }
        })
      : null,
    input.templateId
      ? prisma.invoiceTemplate.findFirst({
          where: { id: input.templateId, workspaceId: input.workspaceId },
          select: { id: true }
        })
      : null,
    input.brandingId
      ? prisma.invoiceBranding.findFirst({
          where: { id: input.brandingId, workspaceId: input.workspaceId },
          select: { id: true }
        })
      : null
  ]);

  if (input.invoiceId && !existingInvoice) {
    throw new Error("Invoice not found for this workspace scope.");
  }
  if (input.clientId && !client) {
    throw new Error("Client is not available for this workspace scope.");
  }
  if (input.matterId && !matter) {
    throw new Error("Matter is not available for this workspace scope.");
  }
  if (input.templateId && !template) {
    throw new Error("Invoice template was not found in this workspace.");
  }
  if (input.brandingId && !branding) {
    throw new Error("Invoice branding was not found in this workspace.");
  }
}

export async function saveInvoice(input: {
  workspaceId: string;
  user: ScopedUser;
  userId: string;
  invoiceId?: string;
  clientId?: string | null;
  matterId?: string | null;
  templateId?: string | null;
  brandingId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientAddress?: string | null;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  lineItems: InvoiceLineItemInput[];
  discountCents?: number;
  notes?: string | null;
  paymentInstructions?: string | null;
  generatedContent?: string | null;
  aiReasoningJson?: Prisma.InputJsonValue | null;
  reviewRequired?: boolean;
  status?: InvoiceStatus;
}) {
  await assertInvoiceReferences({
    workspaceId: input.workspaceId,
    user: input.user,
    invoiceId: input.invoiceId,
    clientId: input.clientId,
    matterId: input.matterId,
    templateId: input.templateId,
    brandingId: input.brandingId
  });

  const totals = calculateInvoiceTotals(input.lineItems, input.discountCents ?? 0);
  const data = {
    workspaceId: input.workspaceId,
    clientId: input.clientId ?? null,
    matterId: input.matterId ?? null,
    templateId: input.templateId ?? null,
    brandingId: input.brandingId ?? null,
    clientName: input.clientName,
    clientEmail: input.clientEmail ?? null,
    clientAddress: input.clientAddress ?? null,
    invoiceNumber: input.invoiceNumber,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    currency: input.currency,
    subtotalCents: totals.subtotalCents,
    gstCents: totals.gstCents,
    discountCents: totals.discountCents,
    totalCents: totals.totalCents,
    lineItemsJson: totals.lineItems as unknown as Prisma.InputJsonValue,
    notes: input.notes ?? null,
    paymentInstructions: input.paymentInstructions ?? null,
    generatedContent: input.generatedContent ?? null,
    aiReasoningJson: input.aiReasoningJson ?? Prisma.JsonNull,
    reviewRequired: input.reviewRequired ?? true,
    status: input.status ?? InvoiceStatus.DRAFT
  };

  if (input.invoiceId) {
    return prisma.invoice.update({
      where: { id: input.invoiceId },
      data
    });
  }

  return prisma.invoice.create({
    data: {
      ...data,
      createdByUserId: input.userId
    }
  });
}

export async function duplicateInvoice(input: {
  invoiceId: string;
  workspaceId: string;
  userId: string;
  user: ScopedUser;
}) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, workspaceId: input.workspaceId, ...scopedInvoiceWhere(input.user) }
  });
  if (!invoice) throw new Error("Invoice not found.");
  const nextNumber = await nextInvoiceNumber(input.workspaceId);
  return prisma.invoice.create({
    data: {
      workspaceId: input.workspaceId,
      clientId: invoice.clientId,
      matterId: invoice.matterId,
      createdByUserId: input.userId,
      templateId: invoice.templateId,
      brandingId: invoice.brandingId,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientAddress: invoice.clientAddress,
      invoiceNumber: nextNumber,
      issueDate: new Date(),
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      subtotalCents: invoice.subtotalCents,
      gstCents: invoice.gstCents,
      discountCents: invoice.discountCents,
      totalCents: invoice.totalCents,
      lineItemsJson: invoice.lineItemsJson as Prisma.InputJsonValue,
      notes: invoice.notes,
      paymentInstructions: invoice.paymentInstructions,
      generatedContent: invoice.generatedContent,
      aiReasoningJson: invoice.aiReasoningJson === null ? Prisma.JsonNull : (invoice.aiReasoningJson as Prisma.InputJsonValue),
      reviewRequired: true,
      status: InvoiceStatus.DRAFT
    }
  });
}

export async function buildInvoiceTemplateRecord(input: {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  notes?: string | null;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  let extractedText: string | null = null;
  const warnings: string[] = [];

  if (input.mimeType === "text/plain") {
    extractedText = input.bytes.toString("utf8");
  } else if (input.mimeType === "application/pdf") {
    extractedText = await extractReadableText(input.bytes, input.mimeType);
  } else if (
    input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    warnings.push("DOCX extraction is not configured yet. Upload is stored securely, but field detection needs manual review.");
  } else {
    warnings.push("Template text extraction is weak for this file type. Manual field review is required.");
  }

  const detectedFields = detectInvoiceTemplateFields(extractedText);
  const asset = await createInvoiceAsset({
    workspaceId: input.workspaceId,
    kind: InvoiceAssetKind.TEMPLATE,
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    extractedText,
    detectedFieldsJson: { detectedFields, warnings }
  });

  return prisma.invoiceTemplate.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name,
      notes: input.notes ?? null,
      extractedText,
      detectedFieldsJson: { detectedFields },
      extractionWarnings: { warnings },
      assetId: asset.id,
      createdByUserId: input.createdByUserId
    },
    include: { asset: true }
  });
}

export async function generateInvoiceWithAi(input: {
  workspaceId: string;
  user: ScopedUser;
  clientId?: string | null;
  matterId?: string | null;
  templateId?: string | null;
  brandingId?: string | null;
  selectedServiceIds?: string[];
  prompt?: string | null;
  issueDate?: Date | null;
  dueDate?: Date | null;
  currency?: string | null;
}) {
  const aiStatus = getAiConfigStatus();
  if (!aiStatus.configured) {
    return {
      status: "not_configured" as const,
      message: "AI is not configured. Add API key in environment variables.",
      setup: `Missing ${aiStatus.missing.join(", ")}.`
    };
  }

  const [branding, template, client, matter, services] = await Promise.all([
    input.brandingId
      ? prisma.invoiceBranding.findFirst({ where: { id: input.brandingId, workspaceId: input.workspaceId }, include: { logoAsset: true, signatureAsset: true } })
      : prisma.invoiceBranding.findUnique({ where: { workspaceId: input.workspaceId }, include: { logoAsset: true, signatureAsset: true } }),
    input.templateId
      ? prisma.invoiceTemplate.findFirst({ where: { id: input.templateId, workspaceId: input.workspaceId }, include: { asset: true } })
      : prisma.invoiceTemplate.findFirst({ where: { workspaceId: input.workspaceId }, orderBy: { createdAt: "desc" }, include: { asset: true } }),
    input.clientId
      ? prisma.client.findFirst({ where: { id: input.clientId, ...scopedClientWhere(input.user) } })
      : null,
    input.matterId
      ? prisma.matter.findFirst({ where: { id: input.matterId, ...scopedMatterWhere(input.user) }, include: { client: true, assignedToUser: true } })
      : null,
    prisma.invoiceService.findMany({
      where: {
        workspaceId: input.workspaceId,
        active: true,
        ...(input.selectedServiceIds?.length ? { id: { in: input.selectedServiceIds } } : {})
      },
      orderBy: { serviceName: "asc" }
    })
  ]);

  if (matter && !canAccessMatter(input.user, matter)) {
    throw new Error("Matter is not available for this user scope.");
  }

  const resolvedClient = client ?? matter?.client ?? null;
  const missingFields: string[] = [];
  if (!branding) missingFields.push("invoice branding setup");
  if (!resolvedClient?.firstName || !resolvedClient?.lastName) missingFields.push("client name");
  if (!resolvedClient?.email) missingFields.push("client email");
  if (!services.length) missingFields.push("service pricing items");
  if (!input.issueDate) missingFields.push("issue date");
  if (!input.dueDate && !branding?.defaultDueDays) missingFields.push("due date");
  if (!input.currency && !branding?.defaultCurrency) missingFields.push("currency");

  if (missingFields.length) {
    return {
      status: "needs_input" as const,
      missingFields,
      questions: missingFields.map((field) => `Please provide or configure ${field} so Aria can generate a review-required invoice draft.`)
    };
  }

  const response = await generateAriaAiResponse({
    system: [
      "You are Aria, an AI-assisted migration operations platform generating a review-required invoice draft.",
      "Do not invent prices, tax rules, client information, or compliance claims.",
      "Use only the supplied branding, template, service pricing, client, and matter data.",
      "Return JSON with keys: summary, lineItems, notes, paymentInstructions, reasoning, missingFields, reviewRequired.",
      "Each line item must include description, quantity, unitPriceCents, gstRateBps, isTaxInclusive."
    ].join(" "),
    user: input.prompt || "Generate a migration-services invoice draft from the available workspace data.",
    context: {
      branding,
      template: template ? {
        id: template.id,
        name: template.name,
        extractedText: template.extractedText,
        detectedFieldsJson: template.detectedFieldsJson
      } : null,
      client: resolvedClient,
      matter: matter ? {
        id: matter.id,
        title: matter.title,
        visaSubclass: matter.visaSubclass,
        stage: matter.stage,
        status: matter.status
      } : null,
      services: services.map((service) => ({
        id: service.id,
        serviceName: service.serviceName,
        description: service.description,
        defaultPriceCents: service.defaultPriceCents,
        currency: service.currency,
        gstRateBps: service.gstRateBps,
        isTaxInclusive: service.isTaxInclusive
      })),
      issueDate: input.issueDate?.toISOString(),
      dueDate: input.dueDate?.toISOString(),
      currency: input.currency || branding?.defaultCurrency || "AUD"
    }
  });

  const aiLineItems = Array.isArray(response.lineItems) ? response.lineItems : [];
  const normalizedLineItems = normalizeInvoiceLineItems(aiLineItems.map((item: any) => ({
    description: String(item.description || "").trim(),
    quantity: Number(item.quantity || 0),
    unitPriceCents: Number(item.unitPriceCents || 0),
    gstRateBps: Number(item.gstRateBps || branding?.defaultGstRateBps || 1000),
    isTaxInclusive: Boolean(item.isTaxInclusive)
  })));

  if (!normalizedLineItems.length) {
    return {
      status: "needs_input" as const,
      missingFields: ["priced line items"],
      questions: ["Aria could not produce line items from the available real data. Please choose services or add line items manually."]
    };
  }

  const invoiceNumber = await nextInvoiceNumber(input.workspaceId);
  const saved = await saveInvoice({
    workspaceId: input.workspaceId,
    user: input.user,
    userId: input.user.id,
    clientId: resolvedClient?.id ?? null,
    matterId: matter?.id ?? null,
    templateId: template?.id ?? null,
    brandingId: branding?.id ?? null,
    clientName: `${resolvedClient?.firstName ?? ""} ${resolvedClient?.lastName ?? ""}`.trim(),
    clientEmail: resolvedClient?.email ?? null,
    clientAddress: null,
    invoiceNumber,
    issueDate: input.issueDate!,
    dueDate: input.dueDate ?? new Date(input.issueDate!.getTime() + (branding?.defaultDueDays ?? 7) * 86400000),
    currency: input.currency || branding?.defaultCurrency || "AUD",
    lineItems: normalizedLineItems,
    notes: typeof response.notes === "string" ? response.notes : null,
    paymentInstructions: typeof response.paymentInstructions === "string" ? response.paymentInstructions : branding?.paymentInstructions ?? null,
    generatedContent: typeof response.summary === "string" ? response.summary : null,
    aiReasoningJson: {
      reasoning: Array.isArray(response.reasoning) ? response.reasoning : [],
      missingFields: Array.isArray(response.missingFields) ? response.missingFields : [],
      citations: Array.isArray(response.citations) ? response.citations : []
    },
    reviewRequired: true,
    status: InvoiceStatus.DRAFT
  });

  return {
    status: "generated" as const,
    invoice: saved,
    summary: typeof response.summary === "string" ? response.summary : "Invoice draft generated.",
    reasoning: Array.isArray(response.reasoning) ? response.reasoning : []
  };
}

export function canViewInvoiceFeature(user: ScopedUser) {
  return hasPermission(user, "can_view_invoices");
}

export function canManageInvoiceFeature(user: ScopedUser) {
  return hasPermission(user, "can_manage_invoices");
}

export function canGenerateInvoiceFeature(user: ScopedUser) {
  return hasPermission(user, "can_generate_invoices") && hasPermission(user, "can_access_ai");
}

export function canSendInvoiceFeature(user: ScopedUser) {
  return hasPermission(user, "can_send_invoices");
}

export function canManageInvoiceSettingsFeature(user: ScopedUser) {
  return hasPermission(user, "can_manage_invoice_settings");
}

export function isInvoiceOverdue(invoice: { status: InvoiceStatus; dueDate: Date }) {
  return invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.CANCELLED && invoice.dueDate.getTime() < Date.now();
}

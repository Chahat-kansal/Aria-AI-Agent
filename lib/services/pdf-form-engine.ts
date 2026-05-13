import crypto from "crypto";
import { PDFCheckBox, PDFDropdown, PDFForm, PDFRadioGroup, PDFTextField, PDFDocument } from "pdf-lib";
import { MatterOfficialFormDraftStatus, OfficialFormSupportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { suggestAriaFieldKey } from "@/lib/services/form-template-catalog";
import { decryptString, encryptBuffer, encryptJson } from "@/lib/security/encryption";

type InspectedField = {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "radio" | "unknown";
  options?: string[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readSensitive(value: string | null | undefined) {
  return value ? decryptString(value) : value ?? null;
}

export async function detectFillableFields(buffer: Buffer) {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields().map((field): InspectedField => {
    const name = field.getName();
    if (field instanceof PDFTextField) return { name, type: "text" };
    if (field instanceof PDFCheckBox) return { name, type: "checkbox" };
    if (field instanceof PDFDropdown) return { name, type: "dropdown", options: field.getOptions() };
    if (field instanceof PDFRadioGroup) return { name, type: "radio", options: field.getOptions() };
    return { name, type: "unknown" };
  });
  return {
    fillable: fields.length > 0,
    fields
  };
}

export async function inspectPdfFormFields(templateId: string) {
  const template = await prisma.officialFormTemplate.findUniqueOrThrow({ where: { id: templateId } });
  if (!template.fileData) {
    return {
      template,
      fillable: false,
      fields: [] as InspectedField[],
      message: template.supportStatus === "ONLINE_ONLY"
        ? "Online application / no official fillable PDF draft supported."
        : "No private PDF file is stored for this template yet."
    };
  }
  const inspected = await detectFillableFields(Buffer.from(template.fileData));
  return {
    template,
    ...inspected,
    message: inspected.fillable ? null : "This PDF is not fillable. Manual review or coordinate mapping is required."
  };
}

async function getMatterFieldLookup(matterId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: {
      client: true,
      applicationDrafts: {
        include: {
          fields: {
            include: { templateField: true },
            orderBy: { templateField: { sortOrder: "asc" } }
          }
        },
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  const latestDraft = matter.applicationDrafts[0];
  const draftValues = new Map<string, string>();
  if (latestDraft) {
    for (const field of latestDraft.fields) {
      const value = readSensitive(field.manualOverride) ?? readSensitive(field.value);
      if (value) {
        draftValues.set(field.templateField.fieldKey, value);
        draftValues.set(normalize(field.templateField.label), value);
      }
    }
  }

  const baseValues = new Map<string, string>([
    ["client first name", matter.client.firstName],
    ["client last name", matter.client.lastName],
    ["client full name", `${matter.client.firstName} ${matter.client.lastName}`.trim()],
    ["applicant full name", `${matter.client.firstName} ${matter.client.lastName}`.trim()],
    ["email", matter.client.email],
    ["phone", matter.client.phone],
    ["nationality", matter.client.nationality],
    ["visa subclass", matter.visaSubclass],
    ["visa stream", matter.visaStream],
    ["matter title", matter.title]
  ]);

  return { matter, baseValues, draftValues };
}

export async function mapPdfFieldsToAriaFields(templateId: string) {
  const inspected = await inspectPdfFormFields(templateId);
  const storedMappings = (inspected.template.fieldMappingsJson as Record<string, string> | null) ?? {};
  const suggestions = inspected.fields.map((field) => {
    const mappedFieldKey = suggestAriaFieldKey(field.name, storedMappings);
    return {
      fieldName: field.name,
      fieldType: field.type,
      mappedFieldKey,
      options: field.options ?? []
    };
  });

  return {
    template: inspected.template,
    fillable: inspected.fillable,
    fields: inspected.fields,
    suggestions
  };
}

export async function saveManualFieldMapping(templateId: string, mappings: Record<string, string>) {
  return prisma.officialFormTemplate.update({
    where: { id: templateId },
    data: { fieldMappingsJson: mappings }
  });
}

async function setFieldValue(form: PDFForm, fieldName: string, value: string) {
  const field = form.getFieldMaybe(fieldName);
  if (!field || !value) return false;
  if (field instanceof PDFTextField) {
    field.setText(value);
    return true;
  }
  if (field instanceof PDFDropdown) {
    const options = field.getOptions();
    if (options.includes(value)) {
      field.select(value);
      return true;
    }
    return false;
  }
  if (field instanceof PDFCheckBox) {
    if (["yes", "true", "1", "checked"].includes(value.toLowerCase())) {
      field.check();
      return true;
    }
    field.uncheck();
    return true;
  }
  if (field instanceof PDFRadioGroup) {
    const options = field.getOptions();
    if (options.includes(value)) {
      field.select(value);
      return true;
    }
  }
  return false;
}

export async function fillPdfForm(input: { templateId: string; matterId: string; fieldValues?: Record<string, string> }) {
  const template = await prisma.officialFormTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
  if (!template.fileData) {
    return { supported: false, reason: "No private template PDF is stored for this form." };
  }

  const inspected = await detectFillableFields(Buffer.from(template.fileData));
  if (!inspected.fillable) {
    return { supported: false, reason: "This PDF is not fillable. Manual review or coordinate mapping is required." };
  }

  const { matter, baseValues, draftValues } = await getMatterFieldLookup(input.matterId);
  const mappings = (template.fieldMappingsJson as Record<string, string> | null) ?? {};
  const pdf = await PDFDocument.load(Buffer.from(template.fileData), { ignoreEncryption: true });
  const form = pdf.getForm();
  const reviewRows: Array<Record<string, unknown>> = [];

  for (const field of inspected.fields) {
    const mappedKey = suggestAriaFieldKey(field.name, mappings);
    const explicit = input.fieldValues?.[field.name];
    const suggested = explicit
      ?? (mappedKey ? draftValues.get(mappedKey) || baseValues.get(normalize(mappedKey)) : undefined)
      ?? draftValues.get(normalize(field.name))
      ?? baseValues.get(normalize(field.name));

    const applied = suggested ? await setFieldValue(form, field.name, suggested) : false;
    reviewRows.push({
      fieldName: field.name,
      mappedFieldKey: mappedKey ?? null,
      value: suggested ?? null,
      applied,
      reviewRequired: true
    });
  }

  const pdfBytes = Buffer.from(await pdf.save());
  const generatedFileName = `${template.formNumber.replace(/[^A-Za-z0-9_-]+/g, "_")}-${matter.client.lastName || "client"}-draft.pdf`;

  const draft = await prisma.matterOfficialFormDraft.upsert({
    where: { matterId_templateId: { matterId: input.matterId, templateId: input.templateId } },
    create: {
      workspaceId: matter.workspaceId,
      matterId: input.matterId,
      templateId: input.templateId,
      createdByUserId: matter.assignedToUserId,
      status: MatterOfficialFormDraftStatus.READY_FOR_REVIEW,
      generatedFileName,
      generatedPdfData: Buffer.from(encryptBuffer(pdfBytes), "utf8"),
      fieldValuesJson: encryptJson(reviewRows),
      warningsJson: encryptJson([
        "AI-assisted draft. Registered migration agent review required before use.",
        "This system does not lodge applications."
      ])
    },
    update: {
      status: MatterOfficialFormDraftStatus.READY_FOR_REVIEW,
      generatedFileName,
      generatedPdfData: Buffer.from(encryptBuffer(pdfBytes), "utf8"),
      fieldValuesJson: encryptJson(reviewRows),
      warningsJson: encryptJson([
        "AI-assisted draft. Registered migration agent review required before use.",
        "This system does not lodge applications."
      ])
    }
  });

  return {
    supported: true,
    draft,
    reviewRows
  };
}

export async function generateMatterFormDraft(input: { matterId: string; templateId: string }) {
  return fillPdfForm({ matterId: input.matterId, templateId: input.templateId });
}

async function buildReviewFieldPack(matterId: string) {
  const { matter, baseValues, draftValues } = await getMatterFieldLookup(matterId);
  const latestDraft = matter.applicationDrafts[0];
  const rows = latestDraft?.fields.map((field) => ({
    fieldName: field.templateField.label,
    mappedFieldKey: field.templateField.fieldKey,
    value: readSensitive(field.manualOverride) ?? readSensitive(field.value) ?? null,
    status: field.status,
    confidence: field.confidence,
    reviewRequired: true
  })) ?? [];

  return {
    matter,
    rows,
    baseValues,
    draftValues
  };
}

async function createUnsupportedOrOnlineOnlyDraft(input: { matterId: string; templateId: string; reason: string }) {
  const template = await prisma.officialFormTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
  const { matter, rows } = await buildReviewFieldPack(input.matterId);
  const generatedFileName = `${template.formNumber.replace(/[^A-Za-z0-9_-]+/g, "_")}-${matter.client.lastName || "client"}-online-field-pack.json`;
  const warnings = [
    input.reason,
    "No generated PDF was created for this template.",
    "Use this as a source-backed field pack for registered migration agent review and manual/online form entry only.",
    "Aria does not lodge applications, auto-sign forms, or make final migration decisions."
  ];

  const draft = await prisma.matterOfficialFormDraft.upsert({
    where: { matterId_templateId: { matterId: input.matterId, templateId: input.templateId } },
    create: {
      workspaceId: matter.workspaceId,
      matterId: input.matterId,
      templateId: input.templateId,
      createdByUserId: matter.assignedToUserId,
      status: MatterOfficialFormDraftStatus.UNSUPPORTED,
      generatedFileName,
      generatedPdfData: null,
      fieldValuesJson: encryptJson(rows),
      warningsJson: encryptJson(warnings)
    },
    update: {
      status: MatterOfficialFormDraftStatus.UNSUPPORTED,
      generatedFileName,
      generatedPdfData: null,
      fieldValuesJson: encryptJson(rows),
      warningsJson: encryptJson(warnings)
    }
  });

  return {
    supported: false,
    draft,
    reason: input.reason,
    reviewRows: rows
  };
}

export async function prepareMatterOfficialFormDraft(input: { matterId: string; templateId: string }) {
  const template = await prisma.officialFormTemplate.findUniqueOrThrow({ where: { id: input.templateId } });

  if (template.supportStatus === OfficialFormSupportStatus.ONLINE_ONLY) {
    return createUnsupportedOrOnlineOnlyDraft({
      matterId: input.matterId,
      templateId: input.templateId,
      reason: "This Home Affairs workflow is online-only in ImmiAccount. Aria prepared a field pack for manual/online entry review instead of a fake PDF."
    });
  }

  if (template.supportStatus === OfficialFormSupportStatus.MANUAL_ONLY) {
    return createUnsupportedOrOnlineOnlyDraft({
      matterId: input.matterId,
      templateId: input.templateId,
      reason: "This official PDF is not fillable. Aria prepared a review field pack instead of pretending the PDF can be filled."
    });
  }

  if (template.supportStatus === OfficialFormSupportStatus.MAPPING_REQUIRED && !template.fileData) {
    return createUnsupportedOrOnlineOnlyDraft({
      matterId: input.matterId,
      templateId: input.templateId,
      reason: "This template still requires a synced PDF or firm-uploaded template before PDF filling is available."
    });
  }

  const result = await generateMatterFormDraft(input);
  if (!result.supported || !result.draft) {
    return createUnsupportedOrOnlineOnlyDraft({
      matterId: input.matterId,
      templateId: input.templateId,
      reason: result.reason ?? "This template could not be converted into a fillable PDF draft. Aria prepared a review field pack instead."
    });
  }

  return result;
}

export async function prepareAllMatterOfficialFormDrafts(input: { matterId: string; workspaceId: string }) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId } });
  const templates = await prisma.officialFormTemplate.findMany({
    where: {
      OR: [{ workspaceId: input.workspaceId }, { workspaceId: null }],
      subclassCodes: { has: matter.visaSubclass }
    },
    orderBy: [{ supportStatus: "asc" }, { formNumber: "asc" }]
  });

  const results = [];
  for (const template of templates) {
    const prepared = await prepareMatterOfficialFormDraft({ matterId: input.matterId, templateId: template.id });
    results.push({
      templateId: template.id,
      formNumber: template.formNumber,
      title: template.title,
      supportStatus: template.supportStatus,
      draftId: prepared.draft?.id ?? null,
      pdfGenerated: Boolean(prepared.supported && prepared.draft?.generatedPdfData),
      reviewPackGenerated: Boolean(prepared.draft && !prepared.draft.generatedPdfData),
      reason: "reason" in prepared ? prepared.reason ?? null : null
    });
  }

  return results;
}

export async function approveMatterFormDraft(draftId: string, approvedByUserId: string) {
  return prisma.matterOfficialFormDraft.update({
    where: { id: draftId },
    data: {
      status: MatterOfficialFormDraftStatus.APPROVED,
      approvedByUserId,
      approvedAt: new Date()
    }
  });
}

export async function publishApprovedFormToClient(draftId: string) {
  return prisma.matterOfficialFormDraft.update({
    where: { id: draftId },
    data: {
      status: MatterOfficialFormDraftStatus.PUBLISHED,
      publishedToClientAt: new Date()
    }
  });
}

export function checksumBuffer(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

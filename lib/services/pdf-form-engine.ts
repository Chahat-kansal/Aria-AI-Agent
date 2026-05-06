import crypto from "crypto";
import { PDFCheckBox, PDFDropdown, PDFForm, PDFRadioGroup, PDFTextField, PDFDocument } from "pdf-lib";
import { MatterOfficialFormDraftStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
    const normalizedName = normalize(field.name);
    const mappedFieldKey =
      storedMappings[field.name]
      ?? (normalizedName.includes("passport") ? "applicant.passport_number" : null)
      ?? (normalizedName.includes("birth") || normalizedName.includes("dob") ? "applicant.date_of_birth" : null)
      ?? (normalizedName.includes("nationality") ? "applicant.nationality" : null)
      ?? (normalizedName.includes("name") ? "applicant.full_name" : null)
      ?? (normalizedName.includes("course") ? "study.course_name" : null)
      ?? (normalizedName.includes("provider") ? "study.provider" : null)
      ?? null;
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
    const mappedKey = mappings[field.name];
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

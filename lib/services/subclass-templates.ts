import { TemplateValueType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const subclass500Template = {
  subclassCode: "500",
  stream: "Higher Education",
  name: "Student visa (Subclass 500)",
  description: "AI-assisted draft application template for Subclass 500 student visa matter preparation. Review required.",
  version: "2026.04",
  sections: [
    {
      key: "applicant",
      title: "Applicant details",
      sortOrder: 10,
      fields: [
        { fieldKey: "applicant.full_name", label: "Full name", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Identity", "Travel"], sortOrder: 10 },
        { fieldKey: "applicant.date_of_birth", label: "Date of birth", valueType: TemplateValueType.DATE, required: true, supportedDocumentCategories: ["Identity", "Travel"], sortOrder: 20 },
        { fieldKey: "applicant.nationality", label: "Nationality", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Identity", "Travel"], sortOrder: 30 },
        { fieldKey: "applicant.passport_number", label: "Passport number", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Identity", "Travel"], sortOrder: 40 }
      ]
    },
    {
      key: "study",
      title: "Study details",
      sortOrder: 20,
      fields: [
        { fieldKey: "study.provider", label: "Education provider", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Education"], sortOrder: 10 },
        { fieldKey: "study.course_name", label: "Course name", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Education"], sortOrder: 20 },
        { fieldKey: "study.coe_number", label: "CoE number", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Education"], sortOrder: 30 },
        { fieldKey: "study.course_start_date", label: "Course start date", valueType: TemplateValueType.DATE, required: true, supportedDocumentCategories: ["Education"], sortOrder: 40 }
      ]
    },
    {
      key: "evidence",
      title: "Evidence and declarations",
      sortOrder: 30,
      fields: [
        { fieldKey: "financial.available_funds", label: "Available funds", valueType: TemplateValueType.CURRENCY, required: true, supportedDocumentCategories: ["Financial"], sortOrder: 10 },
        { fieldKey: "health.oshc_provider", label: "OSHC provider", valueType: TemplateValueType.TEXT, required: true, supportedDocumentCategories: ["Health / Insurance"], sortOrder: 20 },
        { fieldKey: "statement.genuine_student", label: "Genuine student statement present", valueType: TemplateValueType.BOOLEAN, required: true, supportedDocumentCategories: ["Statements / Declarations"], sortOrder: 30 }
      ]
    }
  ],
  requirements: [
    { category: "Identity", label: "Passport identity page", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
    { category: "Education", label: "Confirmation of Enrolment", description: "CoE or equivalent enrolment evidence for the intended course.", ruleKey: "education.coe", required: true },
    { category: "Financial", label: "Financial capacity evidence", description: "Evidence supporting access to funds.", ruleKey: "financial.capacity", required: true },
    { category: "Health / Insurance", label: "OSHC evidence", description: "Health insurance evidence covering the required period.", ruleKey: "health.oshc", required: true },
    { category: "Statements / Declarations", label: "Genuine student statement", description: "Current statement/declaration requiring agent review.", ruleKey: "statement.genuine_student", required: true }
  ],
  checklist: [
    { category: "Identity", label: "Identity fields verified against passport", required: true, sortOrder: 10 },
    { category: "Education", label: "CoE details reviewed and source-linked", required: true, sortOrder: 20 },
    { category: "Financial", label: "Financial capacity evidence reviewed", required: true, sortOrder: 30 },
    { category: "Health / Insurance", label: "OSHC coverage evidence reviewed", required: true, sortOrder: 40 },
    { category: "Client review", label: "Draft sent for client confirmation/sign-off", required: true, sortOrder: 50 }
  ]
};

export async function ensureSubclass500Template(workspaceId?: string | null) {
  const existing = await prisma.visaSubclassTemplate.findFirst({
    where: {
      workspaceId: workspaceId ?? null,
      subclassCode: subclass500Template.subclassCode,
      stream: subclass500Template.stream,
      version: subclass500Template.version
    }
  });

  const template = existing
    ? await prisma.visaSubclassTemplate.update({
        where: { id: existing.id },
        data: {
          name: subclass500Template.name,
          description: subclass500Template.description,
          active: true
        }
      })
    : await prisma.visaSubclassTemplate.create({
        data: {
      workspaceId: workspaceId ?? null,
      subclassCode: subclass500Template.subclassCode,
      stream: subclass500Template.stream,
      name: subclass500Template.name,
      description: subclass500Template.description,
      version: subclass500Template.version,
        }
      });

  for (const sectionDefinition of subclass500Template.sections) {
    const section = await prisma.visaTemplateSection.upsert({
      where: { templateId_key: { templateId: template.id, key: sectionDefinition.key } },
      create: {
        templateId: template.id,
        key: sectionDefinition.key,
        title: sectionDefinition.title,
        sortOrder: sectionDefinition.sortOrder
      },
      update: {
        title: sectionDefinition.title,
        sortOrder: sectionDefinition.sortOrder
      }
    });

    for (const field of sectionDefinition.fields) {
      await prisma.visaTemplateField.upsert({
        where: { templateId_fieldKey: { templateId: template.id, fieldKey: field.fieldKey } },
        create: {
          templateId: template.id,
          sectionId: section.id,
          fieldKey: field.fieldKey,
          label: field.label,
          valueType: field.valueType,
          required: field.required,
          supportedDocumentCategories: field.supportedDocumentCategories,
          sortOrder: field.sortOrder,
          validationRules: { required: field.required }
        },
        update: {
          sectionId: section.id,
          label: field.label,
          valueType: field.valueType,
          required: field.required,
          supportedDocumentCategories: field.supportedDocumentCategories,
          sortOrder: field.sortOrder,
          validationRules: { required: field.required }
        }
      });
    }
  }

  for (const requirement of subclass500Template.requirements) {
    await prisma.visaTemplateRequirement.upsert({
      where: { templateId_ruleKey: { templateId: template.id, ruleKey: requirement.ruleKey } },
      create: { templateId: template.id, ...requirement },
      update: requirement
    });
  }

  await prisma.visaTemplateChecklistItem.deleteMany({ where: { templateId: template.id } });
  await prisma.visaTemplateChecklistItem.createMany({
    data: subclass500Template.checklist.map((item) => ({ templateId: template.id, ...item }))
  });

  return prisma.visaSubclassTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: {
      sections: { include: { fields: true }, orderBy: { sortOrder: "asc" } },
      requirements: true,
      checklistItems: { orderBy: { sortOrder: "asc" } }
    }
  });
}

export async function getSubclass500Template(workspaceId?: string | null) {
  const template = await prisma.visaSubclassTemplate.findFirst({
    where: {
      subclassCode: "500",
      stream: "Higher Education",
      active: true,
      OR: [{ workspaceId: workspaceId ?? null }, { workspaceId: null }]
    },
    include: {
      sections: { include: { fields: true }, orderBy: { sortOrder: "asc" } },
      requirements: true,
      checklistItems: { orderBy: { sortOrder: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });

  return template ?? ensureSubclass500Template(workspaceId);
}

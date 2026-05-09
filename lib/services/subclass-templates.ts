import { prisma } from "@/lib/prisma";
import { getVisaSubclassDefinition, normalizeVisaSubclassCode } from "@/lib/services/visa-field-definitions";

async function ensureVisaSubclassTemplate(workspaceId: string | null | undefined, subclassCode: string) {
  const definition = getVisaSubclassDefinition(subclassCode);
  const normalizedSubclass = normalizeVisaSubclassCode(subclassCode);

  const existing = await prisma.visaSubclassTemplate.findFirst({
    where: {
      workspaceId: workspaceId ?? null,
      subclassCode: normalizedSubclass,
      stream: definition.stream,
      version: definition.version
    }
  });

  const template = existing
    ? await prisma.visaSubclassTemplate.update({
        where: { id: existing.id },
        data: {
          name: definition.name,
          description: definition.description,
          active: true
        }
      })
    : await prisma.visaSubclassTemplate.create({
        data: {
          workspaceId: workspaceId ?? null,
          subclassCode: normalizedSubclass,
          stream: definition.stream,
          name: definition.name,
          description: definition.description,
          version: definition.version
        }
      });

  for (const sectionDefinition of definition.sections) {
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
          validationRules: {
            required: field.required,
            unsafe: field.unsafe ?? false,
            clientConfirmationCategory: field.clientConfirmationCategory ?? null,
            aliases: field.aliases
          }
        },
        update: {
          sectionId: section.id,
          label: field.label,
          valueType: field.valueType,
          required: field.required,
          supportedDocumentCategories: field.supportedDocumentCategories,
          sortOrder: field.sortOrder,
          validationRules: {
            required: field.required,
            unsafe: field.unsafe ?? false,
            clientConfirmationCategory: field.clientConfirmationCategory ?? null,
            aliases: field.aliases
          }
        }
      });
    }
  }

  for (const requirement of definition.requirements) {
    await prisma.visaTemplateRequirement.upsert({
      where: { templateId_ruleKey: { templateId: template.id, ruleKey: requirement.ruleKey } },
      create: { templateId: template.id, ...requirement },
      update: requirement
    });
  }

  await prisma.visaTemplateChecklistItem.deleteMany({ where: { templateId: template.id } });
  await prisma.visaTemplateChecklistItem.createMany({
    data: definition.checklist.map((item) => ({ templateId: template.id, ...item }))
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

export async function ensureTemplateForSubclass(workspaceId: string | null | undefined, subclassCode: string) {
  return ensureVisaSubclassTemplate(workspaceId, subclassCode);
}

export async function getTemplateForSubclass(workspaceId: string | null | undefined, subclassCode: string) {
  const normalizedSubclass = normalizeVisaSubclassCode(subclassCode);
  const definition = getVisaSubclassDefinition(normalizedSubclass);
  const template = await prisma.visaSubclassTemplate.findFirst({
    where: {
      subclassCode: normalizedSubclass,
      stream: definition.stream,
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

  return template ?? ensureVisaSubclassTemplate(workspaceId, normalizedSubclass);
}

export async function getSubclass500Template(workspaceId?: string | null) {
  return getTemplateForSubclass(workspaceId, "500");
}

export async function ensureSubclass500Template(workspaceId?: string | null) {
  return ensureVisaSubclassTemplate(workspaceId, "500");
}

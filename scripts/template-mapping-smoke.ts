import { OfficialFormLifecycleStatus, OfficialFormSupportStatus } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { detectFillableFields, generateMatterFormDraft } from "@/lib/services/pdf-form-engine";
import { saveManualFieldMapping } from "@/lib/services/pdf-form-engine";

const matterId = process.argv[2];

if (!matterId) {
  console.error("Usage: npm exec tsx scripts/template-mapping-smoke.ts <matterId>");
  process.exit(1);
}

async function buildTemplatePdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();

  form.createTextField("Applicant Full Name").addToPage(page, { x: 40, y: 760, width: 250, height: 18 });
  form.createTextField("Passport Number").addToPage(page, { x: 40, y: 730, width: 250, height: 18 });
  form.createTextField("COE Number").addToPage(page, { x: 40, y: 700, width: 250, height: 18 });
  form.createTextField("Education Provider").addToPage(page, { x: 40, y: 670, width: 250, height: 18 });
  form.createTextField("Course Name").addToPage(page, { x: 40, y: 640, width: 250, height: 18 });
  form.createTextField("Available Funds").addToPage(page, { x: 40, y: 610, width: 250, height: 18 });
  form.createTextField("OSHC Provider").addToPage(page, { x: 40, y: 580, width: 250, height: 18 });

  return Buffer.from(await pdf.save());
}

async function main() {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: { workspace: true, assignedToUser: true }
  });

  const pdfBytes = await buildTemplatePdf();
  const inspection = await detectFillableFields(pdfBytes);

  const template = await prisma.officialFormTemplate.create({
    data: {
      workspaceId: matter.workspaceId,
      createdByUserId: matter.assignedToUserId,
      sourceType: "FIRM_TEMPLATE",
      formNumber: `FIRM-MAP-${Date.now()}`,
      title: "Local mapping smoke template",
      category: "Testing",
      sourceName: matter.workspace.name,
      subclassCodes: [matter.visaSubclass],
      lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
      supportStatus: OfficialFormSupportStatus.FILLABLE_PDF,
      isFirmProvided: true,
      downloadedAt: new Date(),
      lastCheckedAt: new Date(),
      fileName: "local-mapping-smoke.pdf",
      mimeType: "application/pdf",
      fileData: pdfBytes,
      fieldSchemaJson: inspection.fields,
      mappingNotes: "Local smoke template for company mapping verification."
    }
  });

  await saveManualFieldMapping(template.id, {
    "Applicant Full Name": "applicant.full_name",
    "Passport Number": "applicant.passport_number",
    "COE Number": "study.coe_number",
    "Education Provider": "study.provider",
    "Course Name": "study.course_name",
    "Available Funds": "financial.available_funds",
    "OSHC Provider": "health.oshc_provider"
  });

  const result = await generateMatterFormDraft({ matterId, templateId: template.id });
  if (!result.supported || !result.draft) {
    throw new Error(result.reason ?? "Template mapping smoke did not generate a draft.");
  }

  console.log(JSON.stringify({
    templateId: template.id,
    draftId: result.draft.id,
    reviewRows: result.reviewRows
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

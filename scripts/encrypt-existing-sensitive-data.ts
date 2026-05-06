import { PrismaClient } from "@prisma/client";
import { encryptJson, encryptString, isEncrypted } from "@/lib/security/encryption";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;

async function maybeEncryptString(value: string | null | undefined) {
  if (!value || isEncrypted(value)) return value;
  return encryptString(value);
}

async function run() {
  const counts = {
    clients: 0,
    extractedFields: 0,
    extractionResults: 0,
    draftFields: 0,
    evidenceLinks: 0,
    intakeRequests: 0
  };

  const clients = await prisma.client.findMany({ select: { id: true, notes: true } });
  for (const client of clients) {
    const nextNotes = await maybeEncryptString(client.notes);
    if (nextNotes !== client.notes) {
      counts.clients += 1;
      if (apply) await prisma.client.update({ where: { id: client.id }, data: { notes: nextNotes } });
    }
  }

  const extractedFields = await prisma.extractedField.findMany({
    select: { id: true, fieldValue: true, sourceSnippet: true, sourcePageRef: true }
  });
  for (const field of extractedFields) {
    const next: Record<string, string> = {};
    const fieldValue = field.fieldValue ? await maybeEncryptString(field.fieldValue) : field.fieldValue;
    const sourceSnippet = await maybeEncryptString(field.sourceSnippet);
    const sourcePageRef = await maybeEncryptString(field.sourcePageRef);
    if (fieldValue && fieldValue !== field.fieldValue) next.fieldValue = fieldValue;
    if (sourceSnippet && sourceSnippet !== field.sourceSnippet) next.sourceSnippet = sourceSnippet;
    if (sourcePageRef && sourcePageRef !== field.sourcePageRef) next.sourcePageRef = sourcePageRef;
    if (Object.keys(next).length) {
      counts.extractedFields += 1;
      if (apply) await prisma.extractedField.update({ where: { id: field.id }, data: next });
    }
  }

  const extractionResults = await prisma.documentExtractionResult.findMany({ select: { id: true, extractedJson: true } });
  for (const result of extractionResults) {
    if (typeof result.extractedJson !== "string" || !isEncrypted(result.extractedJson)) {
      counts.extractionResults += 1;
      if (apply) await prisma.documentExtractionResult.update({ where: { id: result.id }, data: { extractedJson: encryptJson(result.extractedJson) as any } });
    }
  }

  const draftFields = await prisma.matterDraftField.findMany({
    select: { id: true, value: true, sourceSnippet: true, sourcePageRef: true, manualOverride: true, notes: true }
  });
  for (const field of draftFields) {
    const next = {
      value: await maybeEncryptString(field.value),
      sourceSnippet: await maybeEncryptString(field.sourceSnippet),
      sourcePageRef: await maybeEncryptString(field.sourcePageRef),
      manualOverride: await maybeEncryptString(field.manualOverride),
      notes: await maybeEncryptString(field.notes)
    };
    if (Object.values(next).some(Boolean) && (next.value !== field.value || next.sourceSnippet !== field.sourceSnippet || next.sourcePageRef !== field.sourcePageRef || next.manualOverride !== field.manualOverride || next.notes !== field.notes)) {
      counts.draftFields += 1;
      if (apply) await prisma.matterDraftField.update({ where: { id: field.id }, data: next });
    }
  }

  const evidenceLinks = await prisma.matterDraftFieldEvidenceLink.findMany({ select: { id: true, sourceSnippet: true, sourcePageRef: true } });
  for (const link of evidenceLinks) {
    const next = {
      sourceSnippet: await maybeEncryptString(link.sourceSnippet),
      sourcePageRef: await maybeEncryptString(link.sourcePageRef)
    };
    if (next.sourceSnippet !== link.sourceSnippet || next.sourcePageRef !== link.sourcePageRef) {
      counts.evidenceLinks += 1;
      if (apply) await prisma.matterDraftFieldEvidenceLink.update({ where: { id: link.id }, data: next });
    }
  }

  const intakeRequests = await prisma.clientIntakeRequest.findMany({ select: { id: true, questionnaireJson: true } });
  for (const request of intakeRequests) {
    if (request.questionnaireJson && (typeof request.questionnaireJson !== "string" || !isEncrypted(request.questionnaireJson))) {
      counts.intakeRequests += 1;
      if (apply) await prisma.clientIntakeRequest.update({ where: { id: request.id }, data: { questionnaireJson: encryptJson(request.questionnaireJson) as any } });
    }
  }

  console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "apply", counts }, null, 2));
}

run()
  .catch((error) => {
    console.error("[security:encrypt-existing:error]", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

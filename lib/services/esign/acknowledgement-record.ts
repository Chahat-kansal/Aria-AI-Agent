import { decryptJson, decryptString, encryptString } from "@/lib/security/encryption";
import { prisma } from "@/lib/prisma";

export type AcknowledgementRecordView = {
  fileName: string;
  mimeType: string;
  content: string;
};

export async function generateAcknowledgementRecord(requestId: string) {
  const request = await prisma.clientAcknowledgementRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      client: true,
      matter: true,
      response: true
    }
  });

  const responsePayload = request.response?.responseJson
    ? decryptJson<Record<string, unknown>>(request.response.responseJson)
    : null;
  const answers = Array.isArray(responsePayload?.answers) ? responsePayload.answers as Array<Record<string, unknown>> : [];
  const content = [
    `Aria client acknowledgement / confirmation`,
    ``,
    `Title: ${request.title}`,
    `Matter: ${request.matter.title}`,
    `Client: ${request.client.firstName} ${request.client.lastName}`,
    `Provider: ${request.provider}`,
    `Status: ${request.status}`,
    `Submitted: ${request.submittedAt?.toISOString() || "Not submitted"}`,
    `Review status: ${request.response?.reviewStatus || "AGENT_REVIEW_REQUIRED"}`,
    ``,
    `Client acknowledgement / confirmation`,
    `This confirmation does not lodge an application.`,
    `Your migration team will review this before use.`,
    ``,
    ...answers.flatMap((answer, index) => [
      `${index + 1}. ${String(answer.title || "Confirmation item")}`,
      `Response: ${String(answer.response || "confirmed")}`,
      `Detail: ${String(answer.detail || "No extra detail supplied.")}`,
      ``
    ])
  ].join("\n");

  return prisma.acknowledgementRecord.upsert({
    where: { requestId },
    update: {
      title: request.title,
      safeSummary: request.safeSummary,
      fileName: `acknowledgement-${request.id.slice(0, 8)}.txt`,
      mimeType: "text/plain",
      recordContent: encryptString(content)
    },
    create: {
      workspaceId: request.workspaceId,
      matterId: request.matterId,
      clientId: request.clientId,
      requestId: request.id,
      responseId: request.response?.id,
      provider: request.provider,
      title: request.title,
      safeSummary: request.safeSummary,
      fileName: `acknowledgement-${request.id.slice(0, 8)}.txt`,
      mimeType: "text/plain",
      recordContent: encryptString(content)
    }
  });
}

export async function getAcknowledgementRecordView(requestId: string): Promise<AcknowledgementRecordView | null> {
  const record = await prisma.acknowledgementRecord.findUnique({ where: { requestId } });
  if (!record?.recordContent) return null;
  return {
    fileName: record.fileName,
    mimeType: record.mimeType,
    content: decryptString(record.recordContent)
  };
}

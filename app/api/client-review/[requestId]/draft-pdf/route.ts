import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { hashPortalToken } from "@/lib/security/hash";
import { renderClientReviewDraftPdf } from "@/lib/services/client-review-pdf";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "client-review-draft.pdf";
}

export async function GET(_: Request, { params }: { params: { requestId: string } }) {
  const request = await prisma.matterReviewRequest.findFirst({
    where: {
      expiresAt: { gt: new Date() },
      revokedAt: null,
      publicTokenHash: hashPortalToken(params.requestId)
    },
    include: {
      matter: { include: { client: true, workspace: true, assignedToUser: true } },
      draft: { include: { fields: { include: { templateField: true }, orderBy: { templateField: { sortOrder: "asc" } } } } }
    }
  });

  if (!request) {
    return NextResponse.json({ error: "Review request not found." }, { status: 404 });
  }

  const pdf = await renderClientReviewDraftPdf({ request });
  await auditEvent({
    workspaceId: request.matter.workspaceId,
    userId: request.matter.assignedToUserId,
    entityType: "MatterReviewRequest",
    entityId: request.id,
    action: "client_review.pdf_downloaded",
    metadata: { matterId: request.matterId, draftId: request.draftId }
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName(`${request.matter.client.firstName}-${request.matter.client.lastName}-client-review-draft.pdf`)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}

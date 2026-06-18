import { NextResponse } from "next/server";
import { ReviewRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent, auditMatterAction } from "@/lib/services/audit";
import { addMatterTimelineEvent } from "@/lib/services/client-workflows";
import { serverLog } from "@/lib/services/runtime-config";
import { hashPortalToken } from "@/lib/security/hash";

const allowedStatuses = new Set<ReviewRequestStatus>([
  ReviewRequestStatus.VIEWED_BY_CLIENT,
  ReviewRequestStatus.SIGNED_CONFIRMED,
  ReviewRequestStatus.RETURNED_TO_AGENT,
  ReviewRequestStatus.REQUIRES_FOLLOW_UP
]);

export async function PATCH(req: Request, { params }: { params: { requestId: string } }) {
  const body = await req.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status as ReviewRequestStatus : null;
  if (!status || !allowedStatuses.has(status)) return NextResponse.json({ error: "Valid review status is required" }, { status: 400 });

  const existing = await prisma.matterReviewRequest.findFirst({
    where: {
      expiresAt: { gt: new Date() },
      revokedAt: null,
      publicTokenHash: hashPortalToken(params.requestId)
    },
    select: { id: true, matterId: true }
  }).catch((error) => {
    serverLog("client.review.patch_lookup_failed", {
      tokenPreview: params.requestId.slice(0, 6),
      reason: error instanceof Error ? error.message : "lookup_failed"
    });
    return null;
  });

  if (!existing) {
    serverLog("client.review.patch_denied", { tokenPreview: params.requestId.slice(0, 6), reason: "invalid_or_expired" });
    return NextResponse.json({ error: "Review link is invalid or expired." }, { status: 404 });
  }

  const request = await prisma.matterReviewRequest.update({
    where: { id: existing.id },
    data: {
      status,
      viewedAt: status === ReviewRequestStatus.VIEWED_BY_CLIENT ? new Date() : undefined,
      confirmedAt: status === ReviewRequestStatus.SIGNED_CONFIRMED ? new Date() : undefined,
      returnedAt: status === ReviewRequestStatus.RETURNED_TO_AGENT || status === ReviewRequestStatus.REQUIRES_FOLLOW_UP ? new Date() : undefined
    },
    include: { matter: true }
  });

  const action =
    status === ReviewRequestStatus.SIGNED_CONFIRMED
      ? "client_review.confirmed"
      : status === ReviewRequestStatus.RETURNED_TO_AGENT
        ? "client_review.returned"
        : status === ReviewRequestStatus.REQUIRES_FOLLOW_UP
          ? "client_review.follow_up_requested"
          : "client_review.viewed";

  await addMatterTimelineEvent({
    workspaceId: request.matter.workspaceId,
    matterId: request.matterId,
    eventType: action,
    title:
      status === ReviewRequestStatus.SIGNED_CONFIRMED
        ? "Client review confirmed"
        : status === ReviewRequestStatus.RETURNED_TO_AGENT
          ? "Client review returned to agent"
          : status === ReviewRequestStatus.REQUIRES_FOLLOW_UP
            ? "Client review needs follow-up"
            : "Client review viewed",
    description: "Client review workflow status changed through the secure review link."
  }).catch(() => null);

  await auditMatterAction({
    workspaceId: request.matter.workspaceId,
    matterId: request.matterId,
    action,
    metadata: { reviewRequestId: request.id, status }
  });
  await auditEvent({
    workspaceId: request.matter.workspaceId,
    entityType: "MatterReviewRequest",
    entityId: request.id,
    action,
    metadata: { matterId: request.matterId, status }
  });

  return NextResponse.json({ request });
}

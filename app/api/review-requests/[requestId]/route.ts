import { NextResponse } from "next/server";
import { ReviewRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serverLog } from "@/lib/services/runtime-config";

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
    where: { publicToken: params.requestId, expiresAt: { gt: new Date() } },
    select: { id: true, matterId: true }
  });

  if (!existing) {
    serverLog("client.review.patch_denied", { token: params.requestId, reason: "invalid_or_expired" });
    return NextResponse.json({ error: "Review link is invalid or expired." }, { status: 404 });
  }

  const request = await prisma.matterReviewRequest.update({
    where: { id: existing.id },
    data: {
      status,
      viewedAt: status === ReviewRequestStatus.VIEWED_BY_CLIENT ? new Date() : undefined,
      confirmedAt: status === ReviewRequestStatus.SIGNED_CONFIRMED ? new Date() : undefined,
      returnedAt: status === ReviewRequestStatus.RETURNED_TO_AGENT || status === ReviewRequestStatus.REQUIRES_FOLLOW_UP ? new Date() : undefined
    }
  });

  return NextResponse.json({ request });
}

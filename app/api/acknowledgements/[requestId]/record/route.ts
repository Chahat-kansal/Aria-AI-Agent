import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { getAcknowledgementRecordView } from "@/lib/services/esign/acknowledgement-record";
import { auditMatterAction } from "@/lib/services/audit";

export async function GET(_: Request, { params }: { params: { requestId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  const request = await prisma.clientAcknowledgementRequest.findFirst({
    where: {
      id: params.requestId,
      workspaceId: context.workspace.id,
      matter: scopedMatterWhere(context.user)
    },
    select: { id: true, matterId: true }
  });
  if (!request) {
    return NextResponse.json({ error: "Acknowledgement record not found." }, { status: 404 });
  }

  const record = await getAcknowledgementRecordView(request.id);
  if (!record) {
    return NextResponse.json({ error: "Acknowledgement record not available." }, { status: 404 });
  }

  await auditMatterAction({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    matterId: request.matterId,
    action: "acknowledgement.record_downloaded",
    metadata: { requestId: request.id }
  }).catch(() => null);

  return new NextResponse(record.content, {
    headers: {
      "Content-Type": `${record.mimeType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${record.fileName}"`,
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
}

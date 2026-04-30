import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";

export async function GET(_: Request, { params }: { params: { assetId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_view_invoices")) {
    return NextResponse.json({ error: "You do not have permission to access invoice assets." }, { status: 403 });
  }

  const asset = await prisma.invoiceAsset.findFirst({
    where: { id: params.assetId, workspaceId: context.workspace.id }
  });

  if (!asset?.data) {
    return NextResponse.json({ error: "Secure asset preview is not available for this storage provider yet." }, { status: 404 });
  }

  await auditEvent({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    entityType: "InvoiceAsset",
    entityId: asset.id,
    action: "invoice.asset.downloaded"
  });

  return new NextResponse(Buffer.from(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `inline; filename="${asset.fileName}"`
    }
  });
}

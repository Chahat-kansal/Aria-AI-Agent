import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { renderGeneratedDocumentPdf } from "@/lib/services/generated-document-pdf";
import { auditMatterAction } from "@/lib/services/audit";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "aria-draft.pdf";
}

export async function GET(_: Request, { params }: { params: { documentId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_generate_documents")) {
    return NextResponse.json({ error: "You do not have permission to download generated draft PDFs." }, { status: 403 });
  }

  const generatedDocument = await prisma.generatedDocument.findFirst({
    where: { id: params.documentId, workspaceId: context.workspace.id },
    include: {
      workspace: true,
      createdByUser: true,
      matter: { include: { client: true, assignedToUser: true } }
    }
  });

  if (!generatedDocument || !canAccessMatter(context.user, generatedDocument.matter)) {
    return NextResponse.json({ error: "Generated document is not available for this user scope." }, { status: 404 });
  }

  const pdf = await renderGeneratedDocumentPdf({ generatedDocument });
  await auditMatterAction({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    matterId: generatedDocument.matterId,
    action: "generated_document.pdf_downloaded",
    metadata: { generatedDocumentId: generatedDocument.id, type: generatedDocument.type }
  });

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName(`${generatedDocument.title}-firm-draft.pdf`)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}


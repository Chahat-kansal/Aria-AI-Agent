import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { canAccessMatter } from "@/lib/services/roles";
import { auditEvent } from "@/lib/services/audit";
import { decryptBuffer, isEncrypted } from "@/lib/security/encryption";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-") || "form-draft.pdf";
}

export async function GET(req: Request, { params }: { params: { draftId: string } }) {
  const { searchParams } = new URL(req.url);
  const portalToken = searchParams.get("portalToken");

  const draft = await prisma.matterOfficialFormDraft.findUnique({
    where: { id: params.draftId },
    include: { matter: { include: { assignedToUser: true } }, template: true, workspace: true }
  });
  if (!draft || !draft.generatedPdfData) {
    return NextResponse.json({ error: "Form draft not found." }, { status: 404 });
  }

  if (portalToken) {
    const portal = await getClientPortalByToken(portalToken);
    if (!portal || portal.matterId !== draft.matterId || draft.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Client portal access is not valid for this form draft." }, { status: 403 });
    }
    await auditEvent({ workspaceId: draft.workspaceId, entityType: "MatterOfficialFormDraft", entityId: draft.id, action: "downloaded.portal" });
  } else {
    const context = await getCurrentWorkspaceContext();
    if (!context) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    if (draft.workspaceId !== context.workspace.id || !canAccessMatter(context.user, draft.matter)) {
      return NextResponse.json({ error: "Form draft is not available for this user scope." }, { status: 403 });
    }
    await auditEvent({ workspaceId: draft.workspaceId, userId: context.user.id, entityType: "MatterOfficialFormDraft", entityId: draft.id, action: "downloaded" });
  }

  const stored = Buffer.from(draft.generatedPdfData);
  const raw = stored.toString("utf8");
  const bytes = isEncrypted(raw) ? decryptBuffer(raw) : stored;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName(draft.generatedFileName || `${draft.template.formNumber}-draft.pdf`)}"`
    }
  });
}

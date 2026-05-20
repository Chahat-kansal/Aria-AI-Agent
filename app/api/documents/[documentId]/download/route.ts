import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { decryptBuffer, isEncrypted } from "@/lib/security/encryption";
import { auditAccessDenied, auditDocumentDownloaded } from "@/lib/services/audit";
import { getClientPortalByToken, getDocumentRequestByToken } from "@/lib/services/client-workflows";
import { enforceRateLimit, getRequestIp } from "@/lib/security/rate-limit";

function safeDownloadName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

export async function GET(req: Request, { params }: { params: { documentId: string } }) {
  const limited = enforceRateLimit(req, { action: "document.download", scope: `${params.documentId}:${getRequestIp(req)}`, limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  const context = await getCurrentWorkspaceContext();
  const url = new URL(req.url);
  const clientToken = url.searchParams.get("token");

  if (!context && !clientToken) return NextResponse.json({ error: "Authentication or valid client token is required." }, { status: 401 });

  const where: any = { id: params.documentId };
  if (context) where.workspaceId = context.workspace.id;

  const document = await prisma.document.findFirst({
    where,
    include: {
      matter: { include: { assignedToUser: true } },
      storageObject: true
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let clientTokenAllowed = false;
  if (!context && clientToken) {
    const [portal, request] = await Promise.all([
      getClientPortalByToken(clientToken),
      getDocumentRequestByToken(clientToken)
    ]);
    clientTokenAllowed = Boolean(
      (portal && portal.workspaceId === document.workspaceId && portal.clientId === document.clientId && (!portal.matterId || portal.matterId === document.matterId)) ||
      (request && request.workspaceId === document.workspaceId && request.clientId === document.clientId && request.matterId === document.matterId)
    );
  }

  if (context && !canAccessMatter(context.user, document.matter)) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Document",
      entityId: document.id,
      reason: "User tried to download a document outside their matter scope.",
      metadata: { matterId: document.matterId }
    });
    return NextResponse.json({ error: "You do not have access to this document." }, { status: 403 });
  }
  if (!context && !clientTokenAllowed) {
    return NextResponse.json({ error: "The secure client token does not allow this document." }, { status: 403 });
  }

  if (!document.storageObject?.data) {
    return NextResponse.json({ error: "Secure download is not available for this storage provider yet." }, { status: 501 });
  }

  const raw = Buffer.from(document.storageObject.data);
  const asString = raw.toString("utf8");
  const payload = isEncrypted(asString) ? decryptBuffer(asString) : raw;
  if (context) {
    await auditDocumentDownloaded({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      documentId: document.id,
      matterId: document.matterId
    });
  }

  return new NextResponse(payload, {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeDownloadName(document.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

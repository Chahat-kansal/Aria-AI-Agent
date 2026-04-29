import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { documentId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const document = await prisma.document.findFirst({
    where: { id: params.documentId, workspaceId: context.workspace.id },
    include: {
      matter: { include: { assignedToUser: true } },
      storageObject: true
    }
  });

  if (!document || !canAccessMatter(context.user, document.matter)) {
    return NextResponse.json({ error: "You do not have access to this document." }, { status: 403 });
  }

  if (!document.storageObject?.data) {
    return NextResponse.json({ error: "Secure download is not available for this storage provider yet." }, { status: 501 });
  }

  return new NextResponse(Buffer.from(document.storageObject.data), {
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`
    }
  });
}

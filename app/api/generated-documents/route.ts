import { NextResponse } from "next/server";
import { z } from "zod";
import { GeneratedDocumentType } from "@prisma/client";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { generateMatterDocument } from "@/lib/services/client-workflows";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  matterId: z.string().min(1),
  type: z.nativeEnum(GeneratedDocumentType)
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_generate_documents")) {
      return NextResponse.json({ error: "You do not have permission to generate matter documents." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid generated document details are required." }, { status: 400 });
    }

    const matter = await prisma.matter.findFirst({
      where: { id: parsed.data.matterId, workspaceId: context.workspace.id },
      include: { assignedToUser: true }
    });
    if (!matter || !canAccessMatter(context.user, matter)) {
      return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
    }

    const generatedDocument = await generateMatterDocument({
      workspaceId: context.workspace.id,
      matterId: parsed.data.matterId,
      createdByUserId: context.user.id,
      type: parsed.data.type
    });

    return NextResponse.json({ generatedDocument }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("AI is not configured")) {
      return NextResponse.json({
        error: "AI is not configured. Add OPENAI_API_KEY to enable AI-enhanced generated documents.",
        configured: false,
        reviewRequired: true
      }, { status: 503 });
    }
    serverLog("generated_document.create_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to generate the document right now." }, { status: 500 });
  }
}

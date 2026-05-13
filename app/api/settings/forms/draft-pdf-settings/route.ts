import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { updateWorkspaceDraftPdfSettings } from "@/lib/services/draft-pdf-settings";

const schema = z.object({
  termsText: z.string().trim().min(20).max(4000),
  footerText: z.string().trim().min(10).max(600)
});

export async function PATCH(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return NextResponse.json({ error: "You do not have permission to manage draft PDF settings." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Valid draft PDF settings are required." }, { status: 400 });
  }

  const settings = await updateWorkspaceDraftPdfSettings(context.workspace.id, parsed.data);
  return NextResponse.json({ settings });
}


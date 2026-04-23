import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { createMatter } from "@/lib/services/matters";
import { hasPermission } from "@/lib/services/roles";

const matterSchema = z.object({
  clientFirstName: z.string().trim().min(1),
  clientLastName: z.string().trim().min(1),
  clientEmail: z.string().trim().email(),
  clientPhone: z.string().trim().optional(),
  clientDob: z.string().optional(),
  nationality: z.string().trim().optional(),
  title: z.string().trim().min(2),
  visaSubclass: z.string().trim().min(1),
  visaStream: z.string().trim().min(1),
  lodgementTargetDate: z.string().optional()
});

function parseOptionalDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
  if (!hasPermission(context.user, "can_edit_matters")) return NextResponse.json({ error: "You do not have permission to create matters." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = matterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Valid matter and client details are required" }, { status: 400 });

  const matter = await createMatter({
    workspaceId: context.workspace.id,
    assignedToUserId: context.user.id,
    ...parsed.data,
    clientDob: parseOptionalDate(parsed.data.clientDob),
    lodgementTargetDate: parseOptionalDate(parsed.data.lodgementTargetDate)
  });

  return NextResponse.json({ matter }, { status: 201 });
}

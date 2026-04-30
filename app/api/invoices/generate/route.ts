import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";
import { auditAiUsed, auditEvent } from "@/lib/services/audit";
import { generateInvoiceWithAi } from "@/lib/services/invoices";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  clientId: z.string().optional().nullable(),
  matterId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  brandingId: z.string().optional().nullable(),
  selectedServiceIds: z.array(z.string()).optional(),
  prompt: z.string().trim().optional().nullable(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().trim().optional().nullable()
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!hasPermission(context.user, "can_generate_invoices")) {
      return NextResponse.json({ error: "You do not have permission to generate invoices with Aria." }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid invoice generation details are required." }, { status: 400 });
    }

    const result = await generateInvoiceWithAi({
      workspaceId: context.workspace.id,
      user: context.user,
      ...parsed.data
    });

    if (result.status === "generated") {
      await auditAiUsed({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        feature: "invoice.generate",
        metadata: { invoiceId: result.invoice.id }
      });
      await auditEvent({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        entityType: "Invoice",
        entityId: result.invoice.id,
        action: "invoice.generated.ai"
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (result.status === "not_configured") {
      return NextResponse.json(result, { status: 503 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    serverLog("invoice.generate_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to generate the invoice right now." }, { status: 500 });
  }
}

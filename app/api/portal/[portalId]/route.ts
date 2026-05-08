import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { ensureClientPortalToken } from "@/lib/services/client-workflows";
import { auditEvent } from "@/lib/services/audit";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";

export async function PATCH(req: Request, { params }: { params: { portalId: string } }) {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_manage_clients")) {
    return NextResponse.json({ error: "You do not have permission to manage client portal links." }, { status: 403 });
  }

  const existing = await prisma.clientPortalAccessToken.findFirst({
    where: { id: params.portalId, workspaceId: context.workspace.id },
    include: { matter: { include: { assignedToUser: true } }, client: true }
  });
  if (!existing) return NextResponse.json({ error: "Portal link not found." }, { status: 404 });
  if (existing.matter && !canAccessMatter(context.user, existing.matter)) {
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }
  const launchControls = await getWorkspaceLaunchControls(context.workspace.id);
  if (!launchControls.clientPortalEnabled) {
    return NextResponse.json({ error: "Client portal access is disabled by workspace launch controls." }, { status: 409 });
  }
  if (existing.matter && !isSubclassAllowedByLaunchControls(launchControls, existing.matter.visaSubclass)) {
    return NextResponse.json({ error: `Client portal access is disabled for Subclass ${existing.matter.visaSubclass} by current launch controls.` }, { status: 409 });
  }

  const body = await req.json().catch(() => null) as { action?: "revoke" | "regenerate" | "email"; recipientEmail?: string; recipientName?: string } | null;
  const action = body?.action;
  if (!action) return NextResponse.json({ error: "Action is required." }, { status: 400 });

  if (action === "revoke") {
    const revoked = await prisma.clientPortalAccessToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "ClientPortalAccessToken", entityId: revoked.id, action: "revoked" });
    return NextResponse.json({ ok: true, revokedAt: revoked.revokedAt });
  }

  const fresh = await ensureClientPortalToken({
    workspaceId: context.workspace.id,
    clientId: existing.clientId,
    matterId: existing.matterId,
    label: existing.label,
    createdByUserId: context.user.id,
    requestOrigin: new URL(req.url).origin
  });
  await prisma.clientPortalAccessToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }).catch(() => null);

  if (action === "email") {
    const recipientEmail = body?.recipientEmail || existing.client.email;
    if (!recipientEmail) {
      return NextResponse.json({ error: "No client email is stored for this portal link." }, { status: 400 });
    }
    const delivery = await sendClientWorkflowEmail({
      to: recipientEmail,
      recipientName: body?.recipientName || `${existing.client.firstName} ${existing.client.lastName}`.trim(),
      workspaceName: context.workspace.name,
      subject: `${context.workspace.name}: secure client portal link`,
      intro: "Use this secure client portal to upload documents, complete intake steps, and review matter requests.",
      actionLabel: "Open secure client portal",
      actionLink: fresh.url,
      footer: "This link gives access to the client portal for this matter. Share only with the client."
    });
    await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "ClientPortalAccessToken", entityId: fresh.record.id, action: "emailed", metadata: { delivered: delivery.delivered } });
    return NextResponse.json({ ok: true, portalUrl: fresh.url, expiresAt: fresh.record.expiresAt, emailDelivery: delivery });
  }

  await auditEvent({ workspaceId: context.workspace.id, userId: context.user.id, entityType: "ClientPortalAccessToken", entityId: fresh.record.id, action: "regenerated" });
  return NextResponse.json({ ok: true, portalUrl: fresh.url, expiresAt: fresh.record.expiresAt });
}

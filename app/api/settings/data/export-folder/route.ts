import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { decryptBuffer, isEncrypted } from "@/lib/security/encryption";
import { buildStoredZip } from "@/lib/services/zip";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";
import { enforceRateLimit } from "@/lib/security/rate-limit";

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]+/g, "").trim().replace(/\s+/g, " ") || "record";
}

function categoryFolder(category: string) {
  const map: Record<string, string> = {
    Identity: "01 Identity",
    Travel: "02 Visa Documents",
    Education: "03 Education",
    Employment: "04 Employment",
    Relationship: "05 Relationship Evidence",
    Forms: "06 Draft Forms",
    Financial: "07 Approved Copies",
    "Health / Insurance": "07 Approved Copies",
    "Statements / Declarations": "07 Approved Copies",
    "Other Evidence": "07 Approved Copies"
  };
  return map[category] ?? "07 Approved Copies";
}

export async function GET(req: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication is required to export secure client folders." }, { status: 401 });
  }
  if (!hasPermission(context.user, "can_export_data")) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Matter",
      reason: "User tried to export a secure client folder without export permission."
    });
    return NextResponse.json({ error: "You do not have permission to export secure client folders." }, { status: 403 });
  }
  const limited = enforceRateLimit(req, { action: "data.export-folder", scope: `${context.workspace.id}:${context.user.id}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const matterId = searchParams.get("matterId");
  if (!matterId) return NextResponse.json({ error: "matterId is required." }, { status: 400 });

  const matter = await prisma.matter.findFirst({
    where: { id: matterId, workspaceId: context.workspace.id },
    include: {
      client: true,
      assignedToUser: true,
      documents: { include: { storageObject: true }, orderBy: { createdAt: "asc" } },
      checklistItems: { orderBy: { label: "asc" } },
      validationIssues: { orderBy: { createdAt: "asc" } },
      generatedDocuments: { orderBy: { createdAt: "asc" } },
      invoices: { orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { createdAt: "asc" }, take: 200 }
    }
  });

  if (!matter || !canAccessMatter(context.user, matter)) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Matter",
      entityId: matterId,
      reason: "User tried to export a matter outside their access scope."
    });
    return NextResponse.json({ error: "Matter is not available for this user scope." }, { status: 403 });
  }
  const launchControls = await getWorkspaceLaunchControls(context.workspace.id);
  if (!launchControls.exportEnabled) {
    return NextResponse.json({ error: "Secure client-folder export is disabled by workspace launch controls." }, { status: 409 });
  }
  if (!isSubclassAllowedByLaunchControls(launchControls, matter.visaSubclass)) {
    return NextResponse.json({ error: `Exports are disabled for Subclass ${matter.visaSubclass} by current launch controls.` }, { status: 409 });
  }

  const root = `${safeName(`${matter.client.firstName} ${matter.client.lastName}`)}/Matter - Subclass ${safeName(matter.visaSubclass)}`;
  const entries = [
    {
      path: `${root}/00 READ FIRST.txt`,
      data: Buffer.from(
        "This export may contain sensitive client information. Store it securely and follow your firm's privacy, retention, and professional obligations.",
        "utf8"
      )
    },
    {
      path: `${root}/09 Audit Summary/matter-summary.json`,
      data: Buffer.from(
        JSON.stringify(
          {
            client: `${matter.client.firstName} ${matter.client.lastName}`,
            matterTitle: matter.title,
            visaSubclass: matter.visaSubclass,
            stage: matter.stage,
            status: matter.status,
            readinessScore: matter.readinessScore,
            assignedTo: matter.assignedToUser.name
          },
          null,
          2
        ),
        "utf8"
      )
    },
    {
      path: `${root}/09 Audit Summary/checklist-summary.json`,
      data: Buffer.from(JSON.stringify(matter.checklistItems, null, 2), "utf8")
    },
    {
      path: `${root}/09 Audit Summary/audit-summary.json`,
      data: Buffer.from(JSON.stringify(matter.timelineEvents, null, 2), "utf8")
    }
  ];

  for (const generated of matter.generatedDocuments) {
    entries.push({
      path: `${root}/06 Draft Forms/${safeName(generated.title)}.txt`,
      data: Buffer.from(generated.content, "utf8")
    });
  }

  if (matter.invoices.length) {
    entries.push({
      path: `${root}/08 Invoices/invoice-summary.json`,
      data: Buffer.from(JSON.stringify(matter.invoices, null, 2), "utf8")
    });
  }

  for (const document of matter.documents) {
    const stored = document.storageObject?.data ? Buffer.from(document.storageObject.data) : null;
    if (!stored) continue;
    const asString = stored.toString("utf8");
    const bytes = isEncrypted(asString) ? decryptBuffer(asString) : stored;
    entries.push({
      path: `${root}/${categoryFolder(document.category)}/${safeName(document.fileName)}`,
      data: bytes
    });
  }

  const zip = buildStoredZip(entries);
  await auditEvent({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    entityType: "Matter",
    entityId: matter.id,
    action: "exported.secure_client_folder",
    metadata: { documentCount: matter.documents.length, generatedDocumentCount: matter.generatedDocuments.length }
  });

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName(`${matter.client.firstName}-${matter.visaSubclass}-client-folder`)}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

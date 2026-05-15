import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied, auditEvent } from "@/lib/services/audit";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";
import { buildStoredZip } from "@/lib/services/zip";
import { decryptBuffer, isEncrypted } from "@/lib/security/encryption";
import {
  AGENT_CLIENT_FOLDER_DOWNLOADED_EVENT,
  confirmAgentClientFolder,
  getAgentClientFolderConfirmation,
  isAssignedAgentForPrivateFolder
} from "@/lib/services/agent-client-folder";

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

async function getMatterForAgentFolder(matterId: string, workspaceId: string) {
  return prisma.matter.findFirst({
    where: { id: matterId, workspaceId },
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
}

async function requireAssignedAgentContext(matterId: string) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return { error: NextResponse.json({ error: "Authentication is required to open the assigned-agent client folder." }, { status: 401 }) };
  }

  const matter = await getMatterForAgentFolder(matterId, context.workspace.id);
  if (!matter) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Matter",
      entityId: matterId,
      reason: "agent_client_folder_matter_not_found"
    });
    return { error: NextResponse.json({ error: "Matter is not available for this workspace." }, { status: 404 }) };
  }

  if (!isAssignedAgentForPrivateFolder(context.user, matter)) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Matter",
      entityId: matterId,
      reason: "agent_client_folder_assigned_agent_only"
    });
    return { error: NextResponse.json({ error: "This private client folder is only available to the assigned agent after confirmation." }, { status: 403 }) };
  }

  const launchControls = await getWorkspaceLaunchControls(context.workspace.id);
  if (!launchControls.exportEnabled) {
    return { error: NextResponse.json({ error: "Private client folder downloads are disabled by workspace launch controls." }, { status: 409 }) };
  }
  if (!isSubclassAllowedByLaunchControls(launchControls, matter.visaSubclass)) {
    return { error: NextResponse.json({ error: `Private folder downloads are disabled for Subclass ${matter.visaSubclass} by current launch controls.` }, { status: 409 }) };
  }

  return { context, matter };
}

export async function POST(_req: Request, { params }: { params: { matterId: string } }) {
  const result = await requireAssignedAgentContext(params.matterId);
  if ("error" in result) return result.error;

  const confirmation = await confirmAgentClientFolder({
    workspaceId: result.context.workspace.id,
    matterId: result.matter.id,
    userId: result.context.user.id,
    documentCount: result.matter.documents.length,
    generatedDocumentCount: result.matter.generatedDocuments.length
  });

  return NextResponse.json({
    ok: true,
    confirmed: true,
    confirmedAt: confirmation.createdAt,
    downloadUrl: `/api/matters/${result.matter.id}/agent-client-folder`
  }, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function GET(_req: Request, { params }: { params: { matterId: string } }) {
  const result = await requireAssignedAgentContext(params.matterId);
  if ("error" in result) return result.error;

  const confirmation = await getAgentClientFolderConfirmation(result.matter.id);
  if (!confirmation) {
    return NextResponse.json({ error: "Assigned agent confirmation is required before this private client folder can be revealed." }, { status: 409 });
  }

  const root = `${safeName(`${result.matter.client.firstName} ${result.matter.client.lastName}`)}/Matter - Subclass ${safeName(result.matter.visaSubclass)}`;
  const entries = [
    {
      path: `${root}/00 READ FIRST.txt`,
      data: Buffer.from(
        "Assigned-agent private client folder. This archive is generated only after the assigned agent confirms access. Store it securely and follow your firm's privacy, retention, and professional obligations.",
        "utf8"
      )
    },
    {
      path: `${root}/09 Audit Summary/matter-summary.json`,
      data: Buffer.from(
        JSON.stringify(
          {
            matterTitle: result.matter.title,
            visaSubclass: result.matter.visaSubclass,
            stage: result.matter.stage,
            status: result.matter.status,
            readinessScore: result.matter.readinessScore,
            assignedTo: result.matter.assignedToUser.name ?? result.matter.assignedToUser.email,
            folderVisibility: "assigned_agent_only",
            agentConfirmedAt: confirmation.createdAt
          },
          null,
          2
        ),
        "utf8"
      )
    },
    {
      path: `${root}/09 Audit Summary/checklist-summary.json`,
      data: Buffer.from(JSON.stringify(result.matter.checklistItems, null, 2), "utf8")
    },
    {
      path: `${root}/09 Audit Summary/timeline-summary.json`,
      data: Buffer.from(JSON.stringify(result.matter.timelineEvents, null, 2), "utf8")
    }
  ];

  for (const generated of result.matter.generatedDocuments) {
    entries.push({
      path: `${root}/06 Draft Forms/${safeName(generated.title)}.txt`,
      data: Buffer.from(generated.content, "utf8")
    });
  }

  if (result.matter.invoices.length) {
    entries.push({
      path: `${root}/08 Invoices/invoice-summary.json`,
      data: Buffer.from(JSON.stringify(result.matter.invoices, null, 2), "utf8")
    });
  }

  for (const document of result.matter.documents) {
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
    workspaceId: result.context.workspace.id,
    userId: result.context.user.id,
    entityType: "Matter",
    entityId: result.matter.id,
    action: AGENT_CLIENT_FOLDER_DOWNLOADED_EVENT,
    metadata: {
      visibility: "assigned_agent_only",
      documentCount: result.matter.documents.length,
      generatedDocumentCount: result.matter.generatedDocuments.length
    }
  });

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName(`${result.matter.client.firstName}-${result.matter.visaSubclass}-assigned-agent-folder`)}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

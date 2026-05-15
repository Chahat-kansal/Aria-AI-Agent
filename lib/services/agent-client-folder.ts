import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";

export const AGENT_CLIENT_FOLDER_CONFIRMED_EVENT = "agent_client_folder.confirmed";
export const AGENT_CLIENT_FOLDER_DOWNLOADED_EVENT = "agent_client_folder.downloaded";

type MatterForAgentFolder = {
  id: string;
  workspaceId: string;
  assignedToUserId: string;
};

type UserForAgentFolder = Pick<User, "id" | "workspaceId" | "status">;

export function isAssignedAgentForPrivateFolder(user: UserForAgentFolder, matter: MatterForAgentFolder) {
  return user.workspaceId === matter.workspaceId && user.status !== "DISABLED" && matter.assignedToUserId === user.id;
}

export async function getAgentClientFolderConfirmation(matterId: string) {
  return prisma.matterTimelineEvent.findFirst({
    where: { matterId, eventType: AGENT_CLIENT_FOLDER_CONFIRMED_EVENT },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
}

export async function confirmAgentClientFolder(input: {
  workspaceId: string;
  matterId: string;
  userId: string;
  documentCount: number;
  generatedDocumentCount: number;
}) {
  const existing = await getAgentClientFolderConfirmation(input.matterId);
  if (existing) return existing;

  const metadata = {
    visibility: "assigned_agent_only",
    documentCount: input.documentCount,
    generatedDocumentCount: input.generatedDocumentCount
  } satisfies Prisma.InputJsonObject;

  const event = await prisma.matterTimelineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      actorUserId: input.userId,
      eventType: AGENT_CLIENT_FOLDER_CONFIRMED_EVENT,
      title: "Assigned agent confirmed private client folder",
      description: "A client-named folder is available to the assigned agent only. The archive is generated through a permission-checked private route.",
      metadataJson: metadata
    },
    include: { actorUser: { select: { id: true, name: true, email: true } } }
  });

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Matter",
    entityId: input.matterId,
    action: AGENT_CLIENT_FOLDER_CONFIRMED_EVENT,
    metadata
  });

  return event;
}

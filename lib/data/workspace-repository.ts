import { prisma } from "@/lib/prisma";
import { scopedMatterWhere } from "@/lib/services/roles";
import type { User } from "@prisma/client";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDate(value: Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

export async function getOverviewData(workspaceId: string, user?: ScopedUser) {
  const matterWhere = user ? scopedMatterWhere(user) : { workspaceId };
  const [matters, openIssueCount, updates, tasks] = await Promise.all([
    prisma.matter.findMany({
      where: matterWhere,
      include: {
        client: true,
        assignedToUser: true,
        validationIssues: { where: { resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } } }
      },
      orderBy: [{ readinessScore: "asc" }, { updatedAt: "desc" }],
      take: 8
    }),
    prisma.validationIssue.count({
      where: { matter: matterWhere, resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } }
    }),
    prisma.officialUpdate.findMany({
      include: {
        officialSource: true,
        impacts: {
          where: { matter: matterWhere, status: { in: ["NEW", "REVIEWING"] } }
        }
      },
      orderBy: { publishedAt: "desc" },
      take: 6
    }),
    prisma.task.findMany({
      where: { workspaceId, status: { not: "DONE" }, matter: matterWhere },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { dueDate: "asc" },
      take: 8
    })
  ]);

  const allMatterScores = await prisma.matter.findMany({
    where: matterWhere,
    select: { readinessScore: true }
  });

  const averageReadiness = allMatterScores.length
    ? Math.round(allMatterScores.reduce((total, matter) => total + matter.readinessScore, 0) / allMatterScores.length)
    : 0;

  return {
    matters,
    activeMatterCount: allMatterScores.length,
    averageReadiness,
    openIssueCount,
    updates,
    tasks
  };
}

export async function getMattersData(workspaceId: string, user?: ScopedUser) {
  return prisma.matter.findMany({
    where: user ? scopedMatterWhere(user) : { workspaceId },
    include: {
      client: true,
      assignedToUser: true,
      _count: { select: { documents: true, validationIssues: true, tasks: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getMatterDetailData(workspaceId: string, matterId: string, user?: ScopedUser) {
  return prisma.matter.findFirst({
    where: { id: matterId, ...(user ? scopedMatterWhere(user) : { workspaceId }) },
    include: {
      client: true,
      assignedToUser: true,
      documents: { orderBy: { createdAt: "desc" } },
      validationIssues: { orderBy: { createdAt: "desc" } },
      checklistItems: true,
      tasks: { orderBy: { dueDate: "asc" } },
      impacts: {
        include: { officialUpdate: true },
        orderBy: { createdAt: "desc" }
      },
      applicationDrafts: true
    }
  });
}

export async function getDocumentsData(workspaceId: string, user?: ScopedUser) {
  return prisma.document.findMany({
    where: { workspaceId, ...(user ? { matter: scopedMatterWhere(user) } : {}) },
    include: {
      matter: { include: { client: true } },
      uploadedByUser: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getDocumentDetailData(workspaceId: string, documentId: string, user?: ScopedUser) {
  return prisma.document.findFirst({
    where: { id: documentId, workspaceId, ...(user ? { matter: scopedMatterWhere(user) } : {}) },
    include: {
      matter: { include: { client: true } },
      uploadedByUser: true,
      extractionResults: { orderBy: { createdAt: "desc" } },
      extractedFields: { orderBy: { createdAt: "desc" } },
      storageObject: true
    }
  });
}

export async function getTasksData(workspaceId: string, user?: ScopedUser) {
  return prisma.task.findMany({
    where: { workspaceId, ...(user ? { matter: scopedMatterWhere(user) } : {}) },
    include: {
      assignedToUser: true,
      matter: { include: { client: true } }
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });
}

export async function getValidationData(workspaceId: string, user?: ScopedUser) {
  return prisma.validationIssue.findMany({
    where: { matter: user ? scopedMatterWhere(user) : { workspaceId } },
    include: { matter: { include: { client: true } } },
    orderBy: [{ resolutionStatus: "asc" }, { severity: "asc" }, { createdAt: "desc" }]
  });
}

export async function getUpdatesData(workspaceId: string, user?: ScopedUser) {
  return prisma.officialUpdate.findMany({
    include: {
      officialSource: true,
      impacts: {
        where: { matter: user ? scopedMatterWhere(user) : { workspaceId } },
        include: { matter: { include: { client: true } } },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { publishedAt: "desc" }
  });
}

export async function getUpdateDetailData(workspaceId: string, updateId: string, user?: ScopedUser) {
  return prisma.officialUpdate.findFirst({
    where: { id: updateId },
    include: {
      officialSource: true,
      impacts: {
        where: { matter: user ? scopedMatterWhere(user) : { workspaceId } },
        include: { matter: { include: { client: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function getSettingsData(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      users: { orderBy: { name: "asc" } },
      officialSources: { orderBy: { name: "asc" } },
      _count: { select: { matters: true, documents: true, tasks: true, visaKnowledgeRecords: true } }
    }
  });
}

export async function getCompanyProfileData(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      users: { orderBy: { name: "asc" } },
      _count: { select: { matters: true, documents: true, tasks: true, clients: true } }
    }
  });
}

export async function getAssistantData(workspaceId: string, user?: ScopedUser) {
  return prisma.aiChatThread.findMany({
    where: { workspaceId, ...(user ? { OR: [{ matterId: null }, { matter: scopedMatterWhere(user) }] } : {}) },
    include: {
      matter: { include: { client: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { createdAt: "desc" },
    take: 6
  });
}

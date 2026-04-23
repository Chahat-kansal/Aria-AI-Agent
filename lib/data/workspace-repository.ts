import { prisma } from "@/lib/prisma";

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

export async function getOverviewData(workspaceId: string) {
  const [matters, openIssueCount, updates, tasks] = await Promise.all([
    prisma.matter.findMany({
      where: { workspaceId },
      include: {
        client: true,
        assignedToUser: true,
        validationIssues: { where: { resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } } }
      },
      orderBy: [{ readinessScore: "asc" }, { updatedAt: "desc" }],
      take: 8
    }),
    prisma.validationIssue.count({
      where: { matter: { workspaceId }, resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } }
    }),
    prisma.officialUpdate.findMany({
      include: {
        officialSource: true,
        impacts: {
          where: { matter: { workspaceId }, status: { in: ["NEW", "REVIEWING"] } }
        }
      },
      orderBy: { publishedAt: "desc" },
      take: 6
    }),
    prisma.task.findMany({
      where: { workspaceId, status: { not: "DONE" } },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { dueDate: "asc" },
      take: 8
    })
  ]);

  const allMatterScores = await prisma.matter.findMany({
    where: { workspaceId },
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

export async function getMattersData(workspaceId: string) {
  return prisma.matter.findMany({
    where: { workspaceId },
    include: {
      client: true,
      assignedToUser: true,
      _count: { select: { documents: true, validationIssues: true, tasks: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getMatterDetailData(workspaceId: string, matterId: string) {
  return prisma.matter.findFirst({
    where: { id: matterId, workspaceId },
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

export async function getDocumentsData(workspaceId: string) {
  return prisma.document.findMany({
    where: { workspaceId },
    include: {
      matter: { include: { client: true } },
      uploadedByUser: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getDocumentDetailData(workspaceId: string, documentId: string) {
  return prisma.document.findFirst({
    where: { id: documentId, workspaceId },
    include: {
      matter: { include: { client: true } },
      uploadedByUser: true,
      extractionResults: { orderBy: { createdAt: "desc" } },
      extractedFields: { orderBy: { createdAt: "desc" } },
      storageObject: true
    }
  });
}

export async function getTasksData(workspaceId: string) {
  return prisma.task.findMany({
    where: { workspaceId },
    include: {
      assignedToUser: true,
      matter: { include: { client: true } }
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });
}

export async function getValidationData(workspaceId: string) {
  return prisma.validationIssue.findMany({
    where: { matter: { workspaceId } },
    include: { matter: { include: { client: true } } },
    orderBy: [{ resolutionStatus: "asc" }, { severity: "asc" }, { createdAt: "desc" }]
  });
}

export async function getUpdatesData(workspaceId: string) {
  return prisma.officialUpdate.findMany({
    include: {
      officialSource: true,
      impacts: {
        where: { matter: { workspaceId } },
        include: { matter: { include: { client: true } } },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { publishedAt: "desc" }
  });
}

export async function getUpdateDetailData(workspaceId: string, updateId: string) {
  return prisma.officialUpdate.findFirst({
    where: { id: updateId },
    include: {
      officialSource: true,
      impacts: {
        where: { matter: { workspaceId } },
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

export async function getAssistantData(workspaceId: string) {
  return prisma.aiChatThread.findMany({
    where: { workspaceId },
    include: {
      matter: { include: { client: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { createdAt: "desc" },
    take: 6
  });
}

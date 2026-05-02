import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, scopedMatterWhere } from "@/lib/services/roles";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

const matterDetailInclude = Prisma.validator<Prisma.MatterInclude>()({
  client: true,
  assignedToUser: true,
  documents: { orderBy: { createdAt: "desc" } },
  validationIssues: { orderBy: { createdAt: "desc" } },
  checklistItems: { include: { document: true }, orderBy: { label: "asc" } },
  tasks: { orderBy: { dueDate: "asc" } },
  impacts: {
    include: { officialUpdate: true },
    orderBy: { createdAt: "desc" }
  },
  applicationDrafts: true,
  intakeRequests: { orderBy: { createdAt: "desc" } },
  documentRequests: { include: { items: true }, orderBy: { createdAt: "desc" } },
  appointments: { include: { assignedToUser: true }, orderBy: { startsAt: "asc" } },
  generatedDocuments: { orderBy: { createdAt: "desc" } },
  timelineEvents: { include: { actorUser: true }, orderBy: { createdAt: "desc" }, take: 25 }
});

const documentDetailInclude = Prisma.validator<Prisma.DocumentInclude>()({
  matter: { include: { client: true } },
  uploadedByUser: true,
  extractionResults: { orderBy: { createdAt: "desc" } },
  extractedFields: { orderBy: { createdAt: "desc" } },
  draftEvidenceLinks: {
    include: {
      draftField: {
        include: {
          templateField: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  },
  storageObject: true,
  checklistItems: true
});

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
  const canSeeUpdates = user ? hasPermission(user, "can_access_update_monitor") : true;
  const [matters, openIssueCount, updates, tasks, pendingIntakes, pendingDocumentRequests, upcomingAppointments] = await Promise.all([
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
    canSeeUpdates
      ? prisma.officialUpdate.findMany({
          include: {
            officialSource: true,
            impacts: {
              where: { matter: matterWhere, status: { in: ["NEW", "REVIEWING"] } }
            }
          },
          orderBy: { publishedAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { workspaceId, status: { not: "DONE" }, matter: matterWhere },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { dueDate: "asc" },
      take: 8
    }),
    prisma.clientIntakeRequest.count({
      where: { workspaceId, status: { in: ["SENT", "VIEWED", "SUBMITTED"] }, ...(user ? { matter: matterWhere } : {}) }
    }),
    prisma.documentRequest.count({
      where: { workspaceId, status: { in: ["SENT", "VIEWED", "OVERDUE"] }, ...(user ? { matter: matterWhere } : {}) }
    }),
    prisma.appointment.findMany({
      where: { workspaceId, startsAt: { gte: new Date() }, ...(user ? { matter: matterWhere } : {}) },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { startsAt: "asc" },
      take: 5
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
    tasks,
    pendingIntakes,
    pendingDocumentRequests,
    upcomingAppointments
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
    include: matterDetailInclude
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
    include: documentDetailInclude
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
  const visibilityWhere: Prisma.OfficialUpdateWhereInput = {
    AND: [
      {
        isArchived: false,
        OR: [{ workspaceId: null }, { workspaceId }]
      },
      ...(user
        ? [{
            OR: [
              { workspaceId },
              { workspaceId: null, impacts: { some: { matter: scopedMatterWhere(user) } } },
              { workspaceId: null, sourceType: "OFFICIAL" as any }
            ]
          }]
        : [])
    ]
  };

  return prisma.officialUpdate.findMany({
    where: visibilityWhere,
    include: {
      officialSource: true,
      reviewedByUser: true,
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
    where: {
      id: updateId,
      isArchived: false,
      OR: [{ workspaceId: null }, { workspaceId }]
    },
    include: {
      officialSource: true,
      reviewedByUser: true,
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
    where: {
      workspaceId,
      status: "ACTIVE",
      ...(user
        ? {
            createdByUserId: user.id,
            OR: [{ matterId: null }, { matter: scopedMatterWhere(user) }]
          }
        : {})
    },
    include: {
      matter: { include: { client: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 80 }
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 20
  });
}

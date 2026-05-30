import { prisma } from "@/lib/prisma";
import { scopedMatterWhere } from "@/lib/services/roles";

type ScopedUser = {
  id: string;
  workspaceId: string;
  role: any;
  visibilityScope: any;
  status: any;
  permissionsJson: any;
};

function daysUntil(date?: Date | null) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export async function getAgentOperationsSnapshot(user: ScopedUser) {
  const matterWhere = scopedMatterWhere(user);
  const [matters, pendingRequests, pendingAppointments, openReviewRequests, auditEvents] = await Promise.all([
    prisma.matter.findMany({
      where: matterWhere,
      include: {
        client: true,
        documents: true,
        validationIssues: true,
        checklistItems: true,
        reviewRequests: { orderBy: { createdAt: "desc" }, take: 1 },
        documentRequests: { orderBy: { createdAt: "desc" }, take: 1 },
        appointments: { orderBy: { startsAt: "asc" }, take: 1 }
      },
      orderBy: [{ criticalDeadline: "asc" }, { updatedAt: "desc" }],
      take: 50
    }),
    prisma.documentRequest.findMany({
      where: {
        workspaceId: user.workspaceId,
        status: { in: ["SENT", "VIEWED", "OVERDUE"] },
        matter: matterWhere as any
      },
      include: { client: true, matter: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50
    }),
    prisma.appointment.findMany({
      where: {
        workspaceId: user.workspaceId,
        status: { in: ["REQUESTED", "CONFIRMED"] },
        matter: matterWhere as any
      },
      include: { client: true, matter: true },
      orderBy: { startsAt: "asc" },
      take: 50
    }),
    prisma.matterReviewRequest.findMany({
      where: {
        matter: matterWhere as any,
        status: { in: ["REVIEW_REQUESTED", "SENT_TO_CLIENT", "VIEWED_BY_CLIENT"] }
      },
      include: { matter: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: user.workspaceId,
        action: { in: ["document.uploaded", "ai.used", "provider.email.test_success", "provider.sms.test_success", "sms.sent", "sms.template_sent"] }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    })
  ]);

  const deadlineAlerts = matters
    .map((matter) => {
      const criticalDays = daysUntil(matter.criticalDeadline);
      const expiryDays = daysUntil(matter.currentVisaExpiry);
      const dueRequest = matter.documentRequests[0]?.dueDate ? daysUntil(matter.documentRequests[0].dueDate) : null;
      return {
        id: matter.id,
        client: `${matter.client.firstName} ${matter.client.lastName}`,
        title: matter.title,
        visaSubclass: matter.visaSubclass,
        readinessScore: matter.readinessScore,
        criticalDays,
        expiryDays,
        dueRequest
      };
    })
    .filter((item) => item.criticalDays !== null || item.expiryDays !== null || item.dueRequest !== null)
    .sort((a, b) => {
      const aMin = Math.min(...[a.criticalDays, a.expiryDays, a.dueRequest].filter((x): x is number => x !== null));
      const bMin = Math.min(...[b.criticalDays, b.expiryDays, b.dueRequest].filter((x): x is number => x !== null));
      return aMin - bMin;
    });

  const matterHealth = matters.map((matter) => {
    const missingDocs = matter.checklistItems.filter((item) => item.required && !["REVIEWED", "RECEIVED"].includes(item.status)).length;
    const pendingConfirmation = matter.reviewRequests[0] && ["REVIEW_REQUESTED", "SENT_TO_CLIENT", "VIEWED_BY_CLIENT"].includes(matter.reviewRequests[0].status) ? 1 : 0;
    const blockerCount = matter.validationIssues.length;
    const score = Math.max(
      0,
      Math.min(
        100,
        matter.readinessScore - missingDocs * 4 - blockerCount * 6 - pendingConfirmation * 6
      )
    );
    return {
      id: matter.id,
      client: `${matter.client.firstName} ${matter.client.lastName}`,
      title: matter.title,
      visaSubclass: matter.visaSubclass,
      score,
      missingDocs,
      blockerCount,
      pendingConfirmation,
      documentQualityRisk: matter.documents.filter((doc) => doc.reviewStatus === "FLAGGED").length
    };
  }).sort((a, b) => a.score - b.score);

  const clientResponseTracker = pendingRequests.map((request) => ({
    id: request.id,
    client: request.client ? `${request.client.firstName} ${request.client.lastName}` : request.recipientName || "Client",
    matterTitle: request.matter?.title || "Matter",
    status: request.status,
    dueDate: request.dueDate,
    reminderSentAt: request.reminderSentAt
  }));

  const valueMetrics = {
    activeMatters: matters.length,
    documentsProcessed: auditEvents.filter((event) => event.action === "document.uploaded").length,
    draftsGenerated: auditEvents.filter((event) => event.action === "ai.used").length,
    remindersSent: auditEvents.filter((event) => /provider\.(email|sms)\.test_success/.test(event.action) || /^sms\.(sent|template_sent)$/.test(event.action)).length,
    pendingRequests: pendingRequests.length,
    pendingAppointments: pendingAppointments.length,
    pendingConfirmations: openReviewRequests.length,
    estimatedHoursSaved: Number(((auditEvents.filter((event) => event.action === "document.uploaded").length * 0.08) + (auditEvents.filter((event) => event.action === "ai.used").length * 0.18)).toFixed(1))
  };

  return {
    deadlineAlerts,
    matterHealth,
    clientResponseTracker,
    appointments: pendingAppointments.map((appointment) => ({
      id: appointment.id,
      status: appointment.status,
      client: appointment.client ? `${appointment.client.firstName} ${appointment.client.lastName}` : appointment.requestedByName || "Client",
      startsAt: appointment.startsAt,
      meetingType: appointment.meetingType
    })),
    valueMetrics
  };
}

import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDraftReviewData } from "@/lib/services/application-draft";
import { generateDailyBriefing, generateMatterIntelligence, generateNextBestActions, generateSecurityIntelligence } from "@/lib/services/aria-intelligence";
import { hasFirmWideAccess, hasPermission, hasTeamOversight, scopedClientWhere, scopedMatterWhere } from "@/lib/services/roles";

export type AssistantScopedUser = Pick<User, "id" | "workspaceId" | "role" | "status" | "visibilityScope" | "permissionsJson">;

export type AssistantContextInput = {
  workspaceId: string;
  user: AssistantScopedUser;
  contextType?: "WORKSPACE" | "MATTER" | "CLIENT" | "DOCUMENT" | "INVOICE" | "UPDATE" | null;
  contextId?: string | null;
  matterId?: string | null;
};

function toDisplayDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function cleanList(values: Array<string | null | undefined>, limit = 8) {
  return values.filter((value): value is string => Boolean(value)).slice(0, limit);
}

export async function buildAssistantContextPack(input: AssistantContextInput) {
  const matterWhere = scopedMatterWhere(input.user);
  const clientWhere = scopedClientWhere(input.user);
  const effectiveMatterId = input.matterId ?? (input.contextType === "MATTER" ? input.contextId : null);
  const canSeeInvoices = hasPermission(input.user, "can_view_invoices");
  const canSeeUpdates = hasPermission(input.user, "can_access_update_monitor");
  const canSeeSecurity = input.user.role === "COMPANY_OWNER" || input.user.role === "COMPANY_ADMIN" || input.user.role === "ORGANISATION_ACCESS_ADMIN";
  const scopeLabel = hasFirmWideAccess(input.user)
    ? "Workspace briefing"
    : hasTeamOversight(input.user)
      ? "Team-scoped briefing"
      : "My work briefing";

  if (effectiveMatterId) {
    const matter = await prisma.matter.findFirst({
      where: { id: effectiveMatterId, ...matterWhere },
      include: {
        client: true,
        assignedToUser: true,
        documents: { orderBy: { createdAt: "desc" }, take: 10 },
        checklistItems: { include: { document: true }, orderBy: { label: "asc" } },
        validationIssues: { where: { resolutionStatus: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" }, take: 10 },
        documentRequests: { include: { items: { include: { checklistItem: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
        appointments: { include: { assignedToUser: true }, orderBy: { startsAt: "asc" }, take: 5 },
        impacts: {
          include: { officialUpdate: true },
          where: { status: { in: ["NEW", "REVIEWING"] } },
          orderBy: { createdAt: "desc" },
          take: 6
        }
      }
    });

    if (!matter) {
      return {
        scope: "matter",
        contextStatus: "missing",
        message: "The selected matter is no longer available within your access scope."
      };
    }

    const [draftReview, matterIntel, pathways, invoices] = await Promise.all([
      getDraftReviewData(matter.id),
      generateMatterIntelligence(matter.id, input.user),
      prisma.pathwayAnalysis.findMany({
        where: { workspaceId: input.workspaceId, matterId: matter.id },
        include: { options: { orderBy: { rank: "asc" }, take: 3 } },
        orderBy: { createdAt: "desc" },
        take: 3
      }),
      canSeeInvoices
        ? prisma.invoice.findMany({
            where: { workspaceId: input.workspaceId, matterId: matter.id },
            orderBy: { createdAt: "desc" },
            take: 5
          })
        : Promise.resolve([])
    ]);

    return {
      scope: "matter",
      contextStatus: "ok",
      workspace: {
        id: input.workspaceId,
        userRole: input.user.role,
        scopeLabel,
        permissions: {
          canAccessAi: hasPermission(input.user, "can_access_ai"),
          canAccessUpdates: canSeeUpdates,
          canViewInvoices: canSeeInvoices,
          canSeeSecurity
        }
      },
      matter: {
        id: matter.id,
        title: matter.title,
        matterReference: matter.matterReference,
        visaSubclass: matter.visaSubclass,
        visaStream: matter.visaStream,
        stage: matter.stage,
        status: matter.status,
        readinessScore: matter.readinessScore,
        currentVisaStatus: matter.currentVisaStatus,
        currentVisaExpiry: toDisplayDate(matter.currentVisaExpiry),
        criticalDeadline: toDisplayDate(matter.criticalDeadline),
        assignedTo: matter.assignedToUser?.name ?? null,
        client: {
          id: matter.client.id,
          name: `${matter.client.firstName} ${matter.client.lastName}`,
          email: matter.client.email,
          currentVisaStatus: matter.client.currentVisaStatus,
          currentVisaExpiry: toDisplayDate(matter.client.currentVisaExpiry)
        }
      },
      draftReview: {
        readinessScore: draftReview?.draft?.readinessScore ?? matter.readinessScore,
        status: draftReview?.draft?.status ?? null,
        openIssues: (draftReview?.openIssues ?? []).slice(0, 10).map((issue: any) => ({
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          relatedFieldKey: issue.relatedFieldKey ?? null
        })),
        fieldsNeedingReview: (draftReview?.draft?.fields ?? [])
          .filter((field: any) => ["NEEDS_REVIEW", "CONFLICTING", "MISSING"].includes(String(field.status)))
          .slice(0, 10)
          .map((field: any) => ({
            id: field.id,
            label: field.templateField?.label ?? field.templateField?.fieldKey ?? field.id,
            status: field.status,
            confidenceScore: field.confidenceScore ?? null
          }))
      },
      matterIntelligence: {
        summary: matterIntel.summary,
        urgency: matterIntel.urgency,
        riskScore: matterIntel.riskScore,
        groundedFacts: matterIntel.groundedFacts.slice(0, 8),
        missingEvidence: matterIntel.missingEvidence.slice(0, 8),
        recommendedActions: matterIntel.recommendedActions.slice(0, 6),
        clientFollowUps: matterIntel.clientFollowUps.slice(0, 5),
        securityWarnings: matterIntel.securityWarnings.slice(0, 5)
      },
      documents: matter.documents.map((document) => ({
        id: document.id,
        name: document.fileName,
        category: document.category,
        extractionStatus: document.extractionStatus,
        reviewStatus: document.reviewStatus,
        createdAt: toDisplayDate(document.createdAt)
      })),
      checklistGaps: matter.checklistItems
        .filter((item) => !item.documentId || item.status === "MISSING")
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          label: item.label,
          category: item.category,
          status: item.status,
          required: item.required
        })),
      documentRequests: matter.documentRequests.map((request) => ({
        id: request.id,
        status: request.status,
        dueDate: toDisplayDate(request.dueDate),
        missingItems: request.items
          .filter((item) => item.status !== "REVIEWED")
          .map((item) => item.checklistItem?.label ?? `Checklist item ${item.checklistItemId}`)
      })),
      appointments: matter.appointments.map((appointment) => ({
        id: appointment.id,
        startsAt: toDisplayDate(appointment.startsAt),
        status: appointment.status,
        assignedTo: appointment.assignedToUser?.name ?? null,
        meetingType: appointment.meetingType
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        totalCents: invoice.totalCents,
        dueDate: toDisplayDate(invoice.dueDate)
      })),
      pathwayAnalyses: pathways.map((analysis) => ({
        id: analysis.id,
        title: analysis.title,
        topOptions: analysis.options.map((option) => option.title)
      })),
      updateImpacts: matter.impacts.map((impact) => ({
        id: impact.id,
        title: impact.officialUpdate.title,
        summary: impact.officialUpdate.summary,
        reason: impact.reason,
        actionRequired: impact.actionRequired,
        severity: (impact.officialUpdate as any).severity ?? impact.impactLevel,
        sourceUrl: impact.officialUpdate.sourceUrl
      }))
    };
  }

  const [briefing, nextActions, security, matters, documents, documentRequests, appointments, updates, invoices, pathways, clients] = await Promise.all([
    generateDailyBriefing(input.workspaceId, input.user),
    generateNextBestActions(input.workspaceId, input.user),
    canSeeSecurity ? generateSecurityIntelligence(input.workspaceId, input.user) : Promise.resolve(null),
    prisma.matter.findMany({
      where: { ...matterWhere, archivedAt: null },
      include: {
        client: true,
        assignedToUser: true,
        _count: { select: { documents: true, validationIssues: true } }
      },
      orderBy: [{ readinessScore: "asc" }, { updatedAt: "desc" }],
      take: 8
    }),
    prisma.document.findMany({
      where: { workspaceId: input.workspaceId, matter: matterWhere },
      include: { matter: { include: { client: true } } },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.documentRequest.findMany({
      where: { workspaceId: input.workspaceId, matter: matterWhere, status: { in: ["SENT", "VIEWED", "OVERDUE"] } },
      include: { matter: { include: { client: true } }, items: { include: { checklistItem: true } } },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.appointment.findMany({
      where: { workspaceId: input.workspaceId, matter: matterWhere, startsAt: { gte: new Date() } },
      include: { matter: { include: { client: true } }, assignedToUser: true },
      orderBy: { startsAt: "asc" },
      take: 6
    }),
    canSeeUpdates
      ? prisma.officialUpdate.findMany({
          where: {
            isArchived: false,
            OR: [{ workspaceId: null }, { workspaceId: input.workspaceId }]
          },
          include: {
            impacts: {
              where: { matter: matterWhere, status: { in: ["NEW", "REVIEWING"] } },
              include: { matter: { include: { client: true } } }
            }
          },
          orderBy: { publishedAt: "desc" },
          take: 8
        })
      : Promise.resolve([]),
    canSeeInvoices
      ? prisma.invoice.findMany({
          where: { workspaceId: input.workspaceId },
          orderBy: { createdAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    prisma.pathwayAnalysis.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [{ matter: matterWhere }, { client: clientWhere }, { createdByUserId: input.user.id }]
      },
      include: { options: { orderBy: { rank: "asc" }, take: 2 }, matter: true, client: true },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.client.findMany({
      where: { ...clientWhere, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  return {
    scope: "workspace",
    contextStatus: "ok",
    workspace: {
      id: input.workspaceId,
      userRole: input.user.role,
      scopeLabel,
      permissions: {
        canAccessAi: hasPermission(input.user, "can_access_ai"),
        canAccessUpdates: canSeeUpdates,
        canViewInvoices: canSeeInvoices,
        canSeeSecurity
      },
      briefing: {
        summary: briefing.summary,
        urgency: briefing.urgency,
        riskScore: briefing.riskScore,
        topUrgentActions: briefing.topUrgentActions.slice(0, 8)
      },
      nextActions: nextActions.recommendedActions.slice(0, 8),
      security: security
        ? {
            summary: security.summary,
            urgency: security.urgency,
            warnings: security.securityWarnings.slice(0, 10),
            recommendedActions: security.recommendedActions.slice(0, 6)
          }
        : null
    },
    matters: matters.map((matter) => ({
      id: matter.id,
      title: matter.title,
      clientName: `${matter.client.firstName} ${matter.client.lastName}`,
      visaSubclass: matter.visaSubclass,
      stage: matter.stage,
      status: matter.status,
      readinessScore: matter.readinessScore,
      updatedAt: toDisplayDate(matter.updatedAt),
      documentCount: matter._count.documents,
      validationIssueCount: matter._count.validationIssues,
      assignedTo: matter.assignedToUser?.name ?? null
    })),
    clients: clients.map((client) => ({
      id: client.id,
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      currentVisaStatus: client.currentVisaStatus,
      currentVisaExpiry: toDisplayDate(client.currentVisaExpiry)
    })),
    documents: documents.map((document) => ({
      id: document.id,
      name: document.fileName,
      category: document.category,
      extractionStatus: document.extractionStatus,
      matter: document.matter ? `${document.matter.client.firstName} ${document.matter.client.lastName} - ${document.matter.title}` : null
    })),
    checklistGaps: cleanList(
      documentRequests.flatMap((request) =>
        request.items
          .filter((item) => item.status !== "REVIEWED")
          .map((item) => `${request.matter.client.firstName} ${request.matter.client.lastName}: ${item.checklistItem?.label ?? `Checklist item ${item.checklistItemId}`}`)
      ),
      10
    ),
    documentRequests: documentRequests.map((request) => ({
      id: request.id,
      matter: `${request.matter.client.firstName} ${request.matter.client.lastName} - ${request.matter.title}`,
      status: request.status,
      dueDate: toDisplayDate(request.dueDate),
      outstandingItems: request.items
        .filter((item) => item.status !== "REVIEWED")
        .map((item) => item.checklistItem?.label ?? `Checklist item ${item.checklistItemId}`)
    })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      matter: appointment.matter ? `${appointment.matter.client.firstName} ${appointment.matter.client.lastName} - ${appointment.matter.title}` : "Unlinked appointment",
      startsAt: toDisplayDate(appointment.startsAt),
      status: appointment.status,
      assignedTo: appointment.assignedToUser?.name ?? null
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      status: invoice.status,
      totalCents: invoice.totalCents,
      dueDate: toDisplayDate(invoice.dueDate)
    })),
    updates: updates.map((update) => ({
      id: update.id,
      title: update.title,
      summary: update.summary,
      source: update.source,
      sourceType: (update as any).sourceType ?? "OFFICIAL",
      severity: (update as any).severity ?? "INFO",
      publishedAt: toDisplayDate(update.publishedAt),
      affectedSubclasses: Array.isArray((update as any).affectedSubclassesJson) ? (update as any).affectedSubclassesJson : [],
      tags: Array.isArray((update as any).tagsJson) ? (update as any).tagsJson : [],
      impactCount: update.impacts.length
    })),
    pathwayAnalyses: pathways.map((analysis) => ({
      id: analysis.id,
      title: analysis.title,
      matterTitle: analysis.matter?.title ?? null,
      clientName: analysis.client ? `${analysis.client.firstName} ${analysis.client.lastName}` : null,
      topOptions: analysis.options.map((option) => option.title)
    }))
  };
}

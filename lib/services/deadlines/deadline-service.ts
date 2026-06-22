import { Prisma, UserStatus, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import {
  buildDerivedDeadlinesForMatter,
  calculateDaysUntil,
  deriveDeadlineUrgency,
  type DerivedDeadline
} from "@/lib/services/deadlines/deadline-calculator";
import { sendDeadlineReminder, previewDeadlineReminder, type DeadlineReminderTarget } from "@/lib/services/deadlines/deadline-notifications";
import {
  DEADLINE_REVIEW_WARNING,
  canAccessDeadlineCentre,
  canManageDeadlineRecords,
  categoryLabel,
  type DeadlineCategory,
  type DeadlineChannel
} from "@/lib/services/deadlines/deadline-policy";
import { redactDeadlineMetadata, redactDeadlinePreview } from "@/lib/services/deadlines/deadline-redaction";
import { canAccessMatter, hasPermission, hasTeamOversight, scopedMatterWhere, type PermissionKey } from "@/lib/services/roles";

const prismaAny = prisma as any;

export type ScopedDeadlineUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson" | "email" | "name">;

export const deadlineCreateSchema = z.object({
  matterId: z.string().trim().optional().nullable(),
  assignedToUserId: z.string().trim().optional().nullable(),
  title: z.string().trim().min(3).max(160),
  safeSummary: z.string().trim().max(280).optional().nullable(),
  dueAt: z.string().min(1),
  category: z.enum([
    "manual",
    "critical_deadline",
    "visa_expiry",
    "lodgement_target",
    "missing_evidence",
    "client_response",
    "appointment_follow_up",
    "invoice_follow_up",
    "review_required"
  ] satisfies [DeadlineCategory, ...DeadlineCategory[]]),
  reviewRequired: z.boolean().default(true),
  clientVisible: z.boolean().default(false)
});

export const deadlineUpdateSchema = deadlineCreateSchema.partial().extend({
  deadlineId: z.string().min(1)
});

export type DeadlineCentreItem = {
  id: string;
  deadlineId: string | null;
  kind: "manual" | "calculated" | "suggested";
  category: DeadlineCategory;
  categoryLabel: string;
  title: string;
  safeSummary: string | null;
  dueAt: string;
  urgency: "overdue" | "urgent" | "upcoming" | "watch";
  daysUntil: number;
  reviewRequired: boolean;
  clientFacing: boolean;
  clientVisible: boolean;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  sourceLabel: string | null;
  matterId: string | null;
  matterReference: string | null;
  clientId: string | null;
  clientName: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  route: string | null;
  lastReminderAt: string | null;
  reminderStatus: string | null;
  canEdit: boolean;
  canComplete: boolean;
  canSendReminder: boolean;
};

export type DeadlineDashboard = {
  summary: {
    all: number;
    overdue: number;
    urgent: number;
    upcoming: number;
    reviewRequired: number;
    missingEvidence: number;
  };
  items: DeadlineCentreItem[];
  history: Array<{
    id: string;
    deadlineId: string | null;
    eventType: string;
    createdAt: string;
    status: string | null;
    summary: string | null;
  }>;
  audit: Array<{
    id: string;
    action: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
};

function requireDeadlineAccess(user: ScopedDeadlineUser, permission?: PermissionKey) {
  if (user.status === UserStatus.DISABLED) throw new Error("DEADLINE_ACCESS_DENIED");
  if (permission && hasPermission(user, permission)) return;
  if (!canAccessDeadlineCentre(user)) throw new Error("DEADLINE_ACCESS_DENIED");
}

async function assertAssignableUser(workspaceId: string, actor: ScopedDeadlineUser, assignedToUserId?: string | null) {
  if (!assignedToUserId) return null;
  if (assignedToUserId === actor.id) return assignedToUserId;
  if (!hasPermission(actor, "can_manage_team")) {
    throw new Error("DEADLINE_ASSIGNMENT_DENIED");
  }
  const assignee = await prisma.user.findFirst({
    where: { id: assignedToUserId, workspaceId, status: { not: "DISABLED" } },
    select: { id: true }
  });
  if (!assignee) throw new Error("DEADLINE_ASSIGNEE_NOT_FOUND");
  return assignee.id;
}

async function resolveMatterLink(workspaceId: string, actor: ScopedDeadlineUser, matterId?: string | null) {
  if (!matterId) {
    return { matterId: null, clientId: null, matterReference: null, clientName: null };
  }
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, workspaceId },
    include: { assignedToUser: { select: { supervisorId: true } }, client: true }
  });
  if (!matter || !canAccessMatter(actor, matter)) throw new Error("DEADLINE_MATTER_SCOPE_DENIED");
  return {
    matterId: matter.id,
    clientId: matter.clientId,
    matterReference: matter.matterReference || null,
    clientName: `${matter.client.firstName} ${matter.client.lastName}`.trim()
  };
}

function baseRouteForItem(item: { matterId: string | null }) {
  if (item.matterId) return `/app/matters/${item.matterId}`;
  return "/app/deadlines";
}

function serializeManualDeadline(deadline: any, actor: ScopedDeadlineUser): DeadlineCentreItem {
  return {
    id: `manual:${deadline.id}`,
    deadlineId: deadline.id,
    kind: deadline.sourceType === "MANUAL" ? "manual" : deadline.sourceType === "CALCULATED" ? "calculated" : "suggested",
    category: deadline.category,
    categoryLabel: categoryLabel(deadline.category),
    title: deadline.title,
    safeSummary: deadline.safeSummary || null,
    dueAt: deadline.dueAt.toISOString(),
    urgency: deriveDeadlineUrgency(deadline.dueAt),
    daysUntil: calculateDaysUntil(deadline.dueAt),
    reviewRequired: deadline.reviewRequired,
    clientFacing: ["missing_evidence", "client_response", "appointment_follow_up", "invoice_follow_up"].includes(deadline.category),
    clientVisible: Boolean(deadline.clientVisible),
    status: deadline.status,
    sourceLabel: deadline.sourceLabel || "Manual deadline",
    matterId: deadline.matterId || null,
    matterReference: deadline.matter?.matterReference || null,
    clientId: deadline.clientId || null,
    clientName: deadline.client ? `${deadline.client.firstName} ${deadline.client.lastName}`.trim() : null,
    assignedToUserId: deadline.assignedToUserId || null,
    assignedToUserName: deadline.assignedToUser?.name || null,
    route: baseRouteForItem(deadline),
    lastReminderAt: deadline.reminderLastSentAt ? deadline.reminderLastSentAt.toISOString() : null,
    reminderStatus: deadline.reminderStatus || null,
    canEdit: canManageDeadlineRecords(actor),
    canComplete: canManageDeadlineRecords(actor) && deadline.status === "OPEN",
    canSendReminder: hasPermission(actor, "can_send_client_requests") || hasPermission(actor, "can_manage_appointments") || hasPermission(actor, "can_view_invoices")
  };
}

function serializeDerivedDeadline(item: DerivedDeadline, matter: any, actor: ScopedDeadlineUser): DeadlineCentreItem {
  return {
    id: `${item.kind}:${item.id}`,
    deadlineId: null,
    kind: item.kind,
    category: item.category,
    categoryLabel: categoryLabel(item.category),
    title: item.title,
    safeSummary: item.safeSummary,
    dueAt: item.dueAt.toISOString(),
    urgency: item.urgency,
    daysUntil: item.daysUntil,
    reviewRequired: item.reviewRequired,
    clientFacing: item.clientFacing,
    clientVisible: item.clientVisible,
    status: "OPEN",
    sourceLabel: item.sourceLabel,
    matterId: matter.id,
    matterReference: matter.matterReference || null,
    clientId: matter.clientId,
    clientName: `${matter.client.firstName} ${matter.client.lastName}`.trim(),
    assignedToUserId: matter.assignedToUserId || null,
    assignedToUserName: matter.assignedToUser?.name || null,
    route: `/app/matters/${matter.id}`,
    lastReminderAt: null,
    reminderStatus: null,
    canEdit: false,
    canComplete: false,
    canSendReminder: hasPermission(actor, "can_send_client_requests") || hasPermission(actor, "can_manage_appointments") || hasPermission(actor, "can_view_invoices")
  };
}

function buildReminderTarget(item: DeadlineCentreItem): DeadlineReminderTarget {
  return {
    workspaceId: "",
    matterId: item.matterId,
    matterReference: item.matterReference,
    clientId: item.clientId,
    clientName: item.clientName,
    clientEmail: null,
    assignedToUserId: item.assignedToUserId,
    title: item.title,
    category: item.category,
    clientFacing: item.clientFacing,
    clientVisible: item.clientVisible,
    route: item.route
  };
}

async function fetchReminderTarget(item: DeadlineCentreItem, workspaceId: string) {
  const target = buildReminderTarget(item);
  target.workspaceId = workspaceId;
  if (item.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: item.clientId, workspaceId },
      select: { email: true }
    });
    target.clientEmail = client?.email || null;
  }
  return target;
}

export async function getDeadlineDashboard(input: {
  workspaceId: string;
  user: ScopedDeadlineUser;
  matterId?: string | null;
}) {
  requireDeadlineAccess(input.user);

  const matterWhere = input.user ? scopedMatterWhere(input.user) : { workspaceId: input.workspaceId };
  const manualWhere: any = {
    workspaceId: input.workspaceId,
    ...(input.matterId ? { matterId: input.matterId } : {}),
    ...(
      hasPermission(input.user, "can_view_all_matters")
        ? {}
        : hasTeamOversight(input.user)
          ? {
              OR: [
                { matter: scopedMatterWhere(input.user) as Prisma.MatterWhereInput },
                { matterId: null, assignedToUserId: input.user.id },
                { matterId: null, createdByUserId: input.user.id },
                { matterId: null, assignedToUser: { supervisorId: input.user.id } }
              ]
            }
          : {
              OR: [
                { matter: scopedMatterWhere(input.user) as Prisma.MatterWhereInput },
                { matterId: null, assignedToUserId: input.user.id },
                { matterId: null, createdByUserId: input.user.id }
              ]
            }
    )
  };
  const matters = await prisma.matter.findMany({
    where: {
      ...(matterWhere as Prisma.MatterWhereInput),
      ...(input.matterId ? { id: input.matterId } : {})
    },
    include: {
      client: true,
      assignedToUser: true,
      checklistItems: { select: { id: true, label: true, required: true, dueDate: true, documentId: true } },
      documentRequests: { select: { id: true, status: true, dueDate: true, items: { select: { id: true, status: true } } } },
      reviewRequests: { select: { id: true, status: true, expiresAt: true } },
      appointments: { select: { id: true, status: true, meetingType: true, startsAt: true } },
      invoices: hasPermission(input.user, "can_view_invoices")
        ? { select: { id: true, status: true, dueDate: true, invoiceNumber: true } }
        : false
    },
    orderBy: [{ criticalDeadline: "asc" }, { updatedAt: "desc" }],
    take: input.matterId ? 1 : 80
  });

  const manualDeadlines = await prismaAny.matterDeadline.findMany({
    where: manualWhere,
    include: {
      matter: { select: { id: true, matterReference: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      assignedToUser: { select: { id: true, name: true } }
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 200
  });

  const items = [
    ...manualDeadlines.map((deadline: any) => serializeManualDeadline(deadline, input.user)),
    ...matters.flatMap((matter: any) => buildDerivedDeadlinesForMatter(matter).map((item) => serializeDerivedDeadline(item, matter, input.user)))
  ].sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());

  const history = await prismaAny.deadlineEvent.findMany({
    where: { workspaceId: input.workspaceId, ...(input.matterId ? { deadline: { matterId: input.matterId } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  const audit = await prisma.auditEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      action: {
        in: [
          "deadline.created",
          "deadline.updated",
          "deadline.completed",
          "deadline.reminder_previewed",
          "deadline.reminder_sent",
          "deadline.reminder_failed",
          "deadline.reminder_blocked",
          "deadline.access_blocked"
        ]
      }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return {
    summary: {
      all: items.filter((item) => item.status === "OPEN").length,
      overdue: items.filter((item) => item.status === "OPEN" && item.urgency === "overdue").length,
      urgent: items.filter((item) => item.status === "OPEN" && item.urgency === "urgent").length,
      upcoming: items.filter((item) => item.status === "OPEN" && item.urgency === "upcoming").length,
      reviewRequired: items.filter((item) => item.status === "OPEN" && item.reviewRequired).length,
      missingEvidence: items.filter((item) => item.status === "OPEN" && item.category === "missing_evidence").length
    },
    items,
    history: history.map((event: any) => ({
      id: event.id,
      deadlineId: event.deadlineId || null,
      eventType: event.eventType,
      createdAt: event.createdAt.toISOString(),
      status: event.status || null,
      summary: event.summary || null
    })),
    audit: audit.map((event) => ({
      id: event.id,
      action: event.action,
      createdAt: event.createdAt.toISOString(),
      metadata: redactDeadlineMetadata((event.metadataJson || {}) as Record<string, unknown>)
    }))
  } satisfies DeadlineDashboard;
}

export async function createDeadline(input: {
  workspaceId: string;
  actor: ScopedDeadlineUser;
  data: z.infer<typeof deadlineCreateSchema>;
}) {
  requireDeadlineAccess(input.actor);
  if (!canManageDeadlineRecords(input.actor)) throw new Error("DEADLINE_CREATE_DENIED");

  const dueAt = new Date(input.data.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw new Error("DEADLINE_INVALID_DUE_DATE");

  const matter = await resolveMatterLink(input.workspaceId, input.actor, input.data.matterId);
  const assignedToUserId = await assertAssignableUser(input.workspaceId, input.actor, input.data.assignedToUserId);
  const deadline = await prismaAny.matterDeadline.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: matter.matterId,
      clientId: matter.clientId,
      assignedToUserId,
      createdByUserId: input.actor.id,
      title: input.data.title.trim(),
      safeSummary: input.data.safeSummary?.trim() || null,
      dueAt,
      status: "OPEN",
      category: input.data.category,
      sourceType: "MANUAL",
      reviewRequired: input.data.reviewRequired,
      clientVisible: input.data.clientVisible,
      sourceLabel: "Manual deadline"
    }
  });

  await prismaAny.deadlineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      deadlineId: deadline.id,
      actorUserId: input.actor.id,
      eventType: "deadline.created",
      status: "OPEN",
      summary: redactDeadlinePreview(input.data.title)
    }
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "MatterDeadline",
    entityId: deadline.id,
    action: "deadline.created",
    metadata: redactDeadlineMetadata({
      category: input.data.category,
      dueAt: dueAt.toISOString(),
      matterId: matter.matterId,
      clientVisible: input.data.clientVisible
    }) as Prisma.InputJsonObject
  });
  return deadline;
}

export async function updateDeadline(input: {
  workspaceId: string;
  actor: ScopedDeadlineUser;
  data: z.infer<typeof deadlineUpdateSchema>;
}) {
  requireDeadlineAccess(input.actor);
  if (!canManageDeadlineRecords(input.actor)) throw new Error("DEADLINE_UPDATE_DENIED");

  const existing = await prismaAny.matterDeadline.findFirst({
    where: { id: input.data.deadlineId, workspaceId: input.workspaceId },
    include: { matter: { include: { assignedToUser: { select: { supervisorId: true } } } } }
  });
  if (!existing) throw new Error("DEADLINE_NOT_FOUND");
  if (existing.matter && !canAccessMatter(input.actor, existing.matter)) throw new Error("DEADLINE_SCOPE_DENIED");

  const matter = input.data.matterId !== undefined
    ? await resolveMatterLink(input.workspaceId, input.actor, input.data.matterId)
    : {
        matterId: existing.matterId,
        clientId: existing.clientId,
        matterReference: existing.matter?.matterReference || null,
        clientName: null
      };
  const assignedToUserId = input.data.assignedToUserId !== undefined
    ? await assertAssignableUser(input.workspaceId, input.actor, input.data.assignedToUserId)
    : existing.assignedToUserId;
  const dueAt = input.data.dueAt ? new Date(input.data.dueAt) : existing.dueAt;
  if (Number.isNaN(dueAt.getTime())) throw new Error("DEADLINE_INVALID_DUE_DATE");

  const updated = await prismaAny.matterDeadline.update({
    where: { id: existing.id },
    data: {
      matterId: matter.matterId,
      clientId: matter.clientId,
      assignedToUserId,
      title: input.data.title?.trim() || existing.title,
      safeSummary: input.data.safeSummary !== undefined ? input.data.safeSummary?.trim() || null : existing.safeSummary,
      dueAt,
      category: input.data.category || existing.category,
      reviewRequired: input.data.reviewRequired ?? existing.reviewRequired,
      clientVisible: input.data.clientVisible ?? existing.clientVisible
    }
  });

  await prismaAny.deadlineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      deadlineId: updated.id,
      actorUserId: input.actor.id,
      eventType: "deadline.updated",
      status: updated.status,
      summary: redactDeadlinePreview(updated.title)
    }
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "MatterDeadline",
    entityId: updated.id,
    action: "deadline.updated",
    metadata: redactDeadlineMetadata({
      category: updated.category,
      dueAt: updated.dueAt.toISOString(),
      clientVisible: updated.clientVisible
    }) as Prisma.InputJsonObject
  });
  return updated;
}

export async function completeDeadline(input: {
  workspaceId: string;
  actor: ScopedDeadlineUser;
  deadlineId: string;
}) {
  requireDeadlineAccess(input.actor);
  if (!canManageDeadlineRecords(input.actor)) throw new Error("DEADLINE_COMPLETE_DENIED");

  const existing = await prismaAny.matterDeadline.findFirst({
    where: { id: input.deadlineId, workspaceId: input.workspaceId },
    include: { matter: { include: { assignedToUser: { select: { supervisorId: true } } } } }
  });
  if (!existing) throw new Error("DEADLINE_NOT_FOUND");
  if (existing.matter && !canAccessMatter(input.actor, existing.matter)) throw new Error("DEADLINE_SCOPE_DENIED");

  const updated = await prismaAny.matterDeadline.update({
    where: { id: existing.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date()
    }
  });
  await prismaAny.deadlineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      deadlineId: updated.id,
      actorUserId: input.actor.id,
      eventType: "deadline.completed",
      status: "COMPLETED",
      summary: redactDeadlinePreview(updated.title)
    }
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actor.id,
    entityType: "MatterDeadline",
    entityId: updated.id,
    action: "deadline.completed",
    metadata: { category: updated.category } as Prisma.InputJsonObject
  });
  return updated;
}

async function resolveItemForAction(input: {
  workspaceId: string;
  user: ScopedDeadlineUser;
  itemId: string;
  matterId?: string | null;
}) {
  const dashboard = await getDeadlineDashboard({
    workspaceId: input.workspaceId,
    user: input.user,
    matterId: input.matterId
  });
  const item = dashboard.items.find((entry) => entry.id === input.itemId);
  if (!item) throw new Error("DEADLINE_ITEM_NOT_FOUND");
  return item;
}

export async function getDeadlineReminderPreview(input: {
  workspaceId: string;
  user: ScopedDeadlineUser;
  itemId: string;
  channel?: DeadlineChannel | null;
  matterId?: string | null;
}) {
  const item = await resolveItemForAction(input);
  const target = await fetchReminderTarget(item, input.workspaceId);
  const preview = await previewDeadlineReminder({
    actor: input.user,
    target,
    preferredChannel: input.channel
  });
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    entityType: "MatterDeadline",
    entityId: item.deadlineId || item.matterId || item.id,
    action: "deadline.reminder_previewed",
    metadata: { channel: preview.channel, category: item.category } as Prisma.InputJsonObject
  });
  return { item, preview };
}

export async function sendReminderForDeadlineItem(input: {
  workspaceId: string;
  user: ScopedDeadlineUser;
  itemId: string;
  channel?: DeadlineChannel | null;
  matterId?: string | null;
}) {
  const item = await resolveItemForAction(input);
  const target = await fetchReminderTarget(item, input.workspaceId);
  return sendDeadlineReminder({
    actor: input.user,
    deadlineId: item.deadlineId,
    target,
    preferredChannel: input.channel
  });
}

export async function getMatterDeadlinePanel(input: {
  workspaceId: string;
  user: ScopedDeadlineUser;
  matterId: string;
}) {
  const dashboard = await getDeadlineDashboard(input);
  return {
    warning: DEADLINE_REVIEW_WARNING,
    items: dashboard.items.slice(0, 6)
  };
}

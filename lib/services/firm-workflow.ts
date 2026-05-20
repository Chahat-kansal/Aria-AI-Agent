import { MatterStatus, TaskPriority, TaskStatus, UserRole, UserStatus, type UserVisibilityScope } from "@prisma/client";

export type FirmWorkflowUserInput = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  visibilityScope: UserVisibilityScope;
  supervisorId?: string | null;
  counts: {
    mattersAssigned: number;
    tasksAssigned: number;
    clientsAssigned: number;
    uploadedDocuments: number;
  };
};

export type FirmWorkflowMatterInput = {
  id: string;
  assignedToUserId: string;
  status: MatterStatus;
  readinessScore: number;
  criticalDeadline?: Date | null;
  lodgementTargetDate?: Date | null;
};

export type FirmWorkflowTaskInput = {
  id: string;
  assignedToUserId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date;
};

export type FirmWorkflowSummary = {
  workloadRows: Array<{
    userId: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    matterCount: number;
    clientCount: number;
    openTaskCount: number;
    overdueTaskCount: number;
    urgentMatterCount: number;
    lowReadinessMatterCount: number;
    supervisionMode: "Senior review" | "Assigned-only" | "Firm oversight";
    reviewSignal: "Balanced" | "Watch" | "Needs senior review";
  }>;
  supervisionRows: Array<{
    supervisorId: string;
    supervisorName: string;
    superviseeCount: number;
    assignedMatterCount: number;
    overdueTaskCount: number;
    reviewRequired: boolean;
  }>;
  conflictSignals: Array<{
    type: "duplicate-client-email" | "duplicate-client-name" | "same-agent-repeat";
    label: string;
    severity: "LOW" | "MEDIUM";
    reviewRequired: true;
  }>;
  aggregate: {
    activeUsers: number;
    openMatters: number;
    overdueTasks: number;
    lowReadinessMatters: number;
    supervisionReviews: number;
  };
  safetyNotes: string[];
};

const seniorRoles = new Set<UserRole>([
  UserRole.COMPANY_OWNER,
  UserRole.COMPANY_ADMIN,
  UserRole.PRINCIPAL_REGISTERED_MIGRATION_AGENT,
  UserRole.SENIOR_MIGRATION_AGENT
]);

function isOverdue(task: FirmWorkflowTaskInput, now: Date) {
  return task.status !== TaskStatus.DONE && task.dueDate.getTime() < now.getTime();
}

function openMatter(status: MatterStatus) {
  return [MatterStatus.IN_PROGRESS, MatterStatus.AWAITING_DOCS, MatterStatus.READY_FOR_REVIEW, MatterStatus.DRAFT].includes(status);
}

export function buildFirmWorkflowSummary(input: {
  users: FirmWorkflowUserInput[];
  matters: FirmWorkflowMatterInput[];
  tasks: FirmWorkflowTaskInput[];
  possibleClientDuplicates?: Array<{ field: "email" | "name"; label: string; count: number }>;
  now?: Date;
}): FirmWorkflowSummary {
  const now = input.now ?? new Date();
  const activeUsers = input.users.filter((user) => user.status === UserStatus.ACTIVE);
  const openMatters = input.matters.filter((matter) => openMatter(matter.status));
  const lowReadinessMatters = openMatters.filter((matter) => matter.readinessScore < 55);

  const workloadRows = activeUsers.map((user) => {
    const userMatters = openMatters.filter((matter) => matter.assignedToUserId === user.id);
    const userTasks = input.tasks.filter((task) => task.assignedToUserId === user.id && task.status !== TaskStatus.DONE);
    const overdueTaskCount = userTasks.filter((task) => isOverdue(task, now)).length;
    const urgentMatterCount = userMatters.filter((matter) => {
      const deadline = matter.criticalDeadline ?? matter.lodgementTargetDate;
      if (!deadline) return false;
      return deadline.getTime() <= now.getTime() + 14 * 24 * 60 * 60 * 1000;
    }).length;
    const lowReadinessMatterCount = userMatters.filter((matter) => matter.readinessScore < 55).length;
    const needsSeniorReview = overdueTaskCount >= 3 || urgentMatterCount >= 2 || lowReadinessMatterCount >= 3;
    const watch = !needsSeniorReview && (overdueTaskCount > 0 || urgentMatterCount > 0 || lowReadinessMatterCount > 0 || userMatters.length >= 12);

    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      status: user.status,
      matterCount: userMatters.length,
      clientCount: user.counts.clientsAssigned,
      openTaskCount: userTasks.length,
      overdueTaskCount,
      urgentMatterCount,
      lowReadinessMatterCount,
      supervisionMode: seniorRoles.has(user.role) ? "Firm oversight" as const : user.supervisorId ? "Senior review" as const : "Assigned-only" as const,
      reviewSignal: needsSeniorReview ? "Needs senior review" as const : watch ? "Watch" as const : "Balanced" as const
    };
  });

  const supervisionRows = activeUsers
    .filter((user) => seniorRoles.has(user.role))
    .map((supervisor) => {
      const supervisees = activeUsers.filter((user) => user.supervisorId === supervisor.id);
      const assignedMatterCount = supervisees.reduce((count, user) => count + openMatters.filter((matter) => matter.assignedToUserId === user.id).length, 0);
      const overdueTaskCount = supervisees.reduce((count, user) => count + input.tasks.filter((task) => task.assignedToUserId === user.id && isOverdue(task, now)).length, 0);
      return {
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        superviseeCount: supervisees.length,
        assignedMatterCount,
        overdueTaskCount,
        reviewRequired: overdueTaskCount > 0 || assignedMatterCount >= 15
      };
    })
    .filter((row) => row.superviseeCount > 0);

  const conflictSignals = (input.possibleClientDuplicates ?? []).map((duplicate) => ({
    type: duplicate.field === "email" ? "duplicate-client-email" as const : "duplicate-client-name" as const,
    label: `${duplicate.label} appears ${duplicate.count} times. Review before opening a new related matter.`,
    severity: duplicate.field === "email" ? "MEDIUM" as const : "LOW" as const,
    reviewRequired: true as const
  }));

  return {
    workloadRows,
    supervisionRows,
    conflictSignals,
    aggregate: {
      activeUsers: activeUsers.length,
      openMatters: openMatters.length,
      overdueTasks: input.tasks.filter((task) => isOverdue(task, now)).length,
      lowReadinessMatters: lowReadinessMatters.length,
      supervisionReviews: supervisionRows.filter((row) => row.reviewRequired).length
    },
    safetyNotes: [
      "Firm workflow dashboards show operational counts and review signals only.",
      "Agents remain scoped by assigned matter, team oversight, or firm-wide permission checks.",
      "Conflict signals are operational prompts and require human review before action."
    ]
  };
}

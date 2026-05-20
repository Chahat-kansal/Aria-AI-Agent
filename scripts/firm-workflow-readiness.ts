import { MatterStatus, TaskPriority, TaskStatus, UserRole, UserStatus, UserVisibilityScope } from "@prisma/client";
import { buildFirmWorkflowSummary } from "../lib/services/firm-workflow";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-05-21T10:00:00.000Z");
const supervisorId = "senior-user";
const agentId = "agent-user";

const summary = buildFirmWorkflowSummary({
  now,
  users: [
    {
      id: supervisorId,
      name: "Senior Migration Agent",
      email: "senior@example.test",
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      counts: { mattersAssigned: 1, clientsAssigned: 1, tasksAssigned: 1, uploadedDocuments: 0 }
    },
    {
      id: agentId,
      name: "Assigned Agent",
      email: "agent@example.test",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      supervisorId,
      counts: { mattersAssigned: 4, clientsAssigned: 4, tasksAssigned: 5, uploadedDocuments: 2 }
    }
  ],
  matters: [
    { id: "matter-a", assignedToUserId: agentId, status: MatterStatus.AWAITING_DOCS, readinessScore: 35, criticalDeadline: new Date("2026-05-29T10:00:00.000Z") },
    { id: "matter-b", assignedToUserId: agentId, status: MatterStatus.IN_PROGRESS, readinessScore: 45, lodgementTargetDate: new Date("2026-06-02T10:00:00.000Z") },
    { id: "matter-c", assignedToUserId: supervisorId, status: MatterStatus.IN_PROGRESS, readinessScore: 80 }
  ],
  tasks: [
    { id: "task-a", assignedToUserId: agentId, status: TaskStatus.OPEN, priority: TaskPriority.HIGH, dueDate: new Date("2026-05-20T10:00:00.000Z") },
    { id: "task-b", assignedToUserId: agentId, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM, dueDate: new Date("2026-05-19T10:00:00.000Z") },
    { id: "task-c", assignedToUserId: supervisorId, status: TaskStatus.DONE, priority: TaskPriority.LOW, dueDate: new Date("2026-05-18T10:00:00.000Z") }
  ],
  possibleClientDuplicates: [{ field: "email", label: "duplicate@example.test", count: 2 }]
});

const agentRow = summary.workloadRows.find((row) => row.userId === agentId);
assert(agentRow, "Agent workload row missing.");
assert(agentRow?.supervisionMode === "Senior review", "Supervised agent should be marked for senior review mode.");
assert(agentRow?.reviewSignal === "Needs senior review", "Agent should be escalated for senior review when workload risk is high.");
assert(summary.supervisionRows.some((row) => row.supervisorId === supervisorId && row.reviewRequired), "Supervisor review signal missing.");
assert(summary.conflictSignals.length === 1 && summary.conflictSignals[0].reviewRequired, "Conflict prompt should be review-required.");
assert(summary.safetyNotes.every((note) => !/ready to lodge/i.test(note)), "Safety notes must not use forbidden lodgement wording.");

console.log("Firm workflow readiness passed.");
console.log(JSON.stringify(summary.aggregate, null, 2));

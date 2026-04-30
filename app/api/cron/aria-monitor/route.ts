import { NextResponse } from "next/server";
import { TaskPriority, TaskStatus, UserRole, UserStatus, UserVisibilityScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { generateDailyBriefing, generateNextBestActions, generateSecurityIntelligence } from "@/lib/services/aria-intelligence";
import { refreshRetrievalIndexForWorkspace } from "@/lib/services/retrieval";
import { serverLog } from "@/lib/services/runtime-config";

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  const userAgent = req.headers.get("user-agent") || "";
  return userAgent.includes("vercel-cron") && Boolean(secret);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    include: {
      users: {
        where: { status: UserStatus.ACTIVE },
        orderBy: { name: "asc" }
      }
    }
  });

  const results: Array<{ workspaceId: string; status: string; actionsCreated: number }> = [];

  for (const workspace of workspaces) {
    try {
      const owner =
        workspace.users.find((user: any) => user.role === UserRole.COMPANY_OWNER) ||
        workspace.users.find((user: any) => user.role === UserRole.COMPANY_ADMIN) ||
        workspace.users[0];

      if (!owner) {
        results.push({ workspaceId: workspace.id, status: "skipped-no-user", actionsCreated: 0 });
        continue;
      }

      const scopedUser = {
        id: owner.id,
        workspaceId: workspace.id,
        role: owner.role,
        visibilityScope: owner.visibilityScope ?? UserVisibilityScope.FIRM_WIDE,
        status: owner.status,
        permissionsJson: owner.permissionsJson
      };

      const [briefing, nextActions, security] = await Promise.all([
        generateDailyBriefing(workspace.id, scopedUser),
        generateNextBestActions(workspace.id, scopedUser),
        generateSecurityIntelligence(workspace.id, scopedUser)
      ]);

      await refreshRetrievalIndexForWorkspace(workspace.id);

      let actionsCreated = 0;
      for (const action of [...briefing.topUrgentActions, ...security.recommendedActions].slice(0, 4)) {
        const existing = await prisma.task.findFirst({
          where: {
            workspaceId: workspace.id,
            assignedToUserId: owner.id,
            title: `Aria monitor: ${action.title}`,
            status: { not: TaskStatus.DONE }
          }
        });

        if (!existing && action.entityType === "Matter") {
          await prisma.task.create({
            data: {
              workspaceId: workspace.id,
              matterId: action.entityId,
              assignedToUserId: owner.id,
              title: `Aria monitor: ${action.title}`,
              description: action.reason,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              status: TaskStatus.OPEN,
              priority: action.priority === "critical" ? TaskPriority.URGENT : action.priority === "high" ? TaskPriority.HIGH : TaskPriority.MEDIUM
            }
          });
          actionsCreated += 1;
        }
      }

      await auditEvent({
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "Workspace",
        entityId: workspace.id,
        action: "cron.aria_monitor",
        metadata: {
          briefingUrgency: briefing.urgency,
          securityUrgency: security.urgency,
          actionsCreated,
          nextActionCount: nextActions.recommendedActions.length
        }
      });

      results.push({ workspaceId: workspace.id, status: "ok", actionsCreated });
    } catch (error) {
      serverLog("cron.aria_monitor_error", {
        workspaceId: workspace.id,
        error: error instanceof Error ? error.message : String(error)
      });
      results.push({ workspaceId: workspace.id, status: "failed", actionsCreated: 0 });
    }
  }

  return NextResponse.json({ ok: true, workspaces: results });
}

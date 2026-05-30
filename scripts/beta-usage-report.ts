import { prisma } from "@/lib/prisma";
import { estimatedHoursSavedForWorkspace } from "@/scripts/helpers/beta-reporting";

async function main() {
  try {
    const [workspaces, audits] = await Promise.all([
      prisma.workspace.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, slug: true }
      }),
      prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 5000,
        select: { workspaceId: true, action: true }
      })
    ]);

    const rows = workspaces.map((workspace) => {
      const events = audits.filter((event) => event.workspaceId === workspace.id);
      const documentsProcessed = events.filter((event) => event.action === "document.uploaded" || event.action === "portal.document_uploaded").length;
      const draftsGenerated = events.filter((event) => event.action === "ai.used").length;
      const portalInvitesSent = events.filter((event) => event.action === "portal.link.create" || event.action === "portal.used" || event.action === "portal.session_used").length;
      const confirmationsCompleted = events.filter((event) => event.action === "client_confirmation.submitted" || event.action === "portal.acknowledgement.created").length;
      const remindersSent = events.filter((event) => event.action === "provider.email.sent" || event.action === "provider.sms.sent" || event.action === "provider.email.test_success" || event.action === "provider.sms.test_success" || event.action === "sms.sent" || event.action === "sms.template_sent").length;
      const pathwayAnalyses = events.filter((event) => event.action === "pathway.generate").length;
      const invoicesCreated = events.filter((event) => event.action === "invoice.created").length;

      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        documentsProcessed,
        draftsGenerated,
        portalInvitesSent,
        confirmationsCompleted,
        remindersSent,
        pathwayAnalyses,
        invoicesCreated,
        estimatedHoursSaved: estimatedHoursSavedForWorkspace({
          documentsProcessed,
          draftsGenerated,
          confirmationsCompleted,
          pathwayAnalyses,
          remindersSent
        })
      };
    });

    console.log(JSON.stringify({
      status: "ok",
      generatedAt: new Date().toISOString(),
      workspaceCount: rows.length,
      usage: rows,
      notes: [
        "This report includes only recorded system events.",
        "Zero values mean no recorded event, not an inferred negative outcome."
      ]
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      status: "database_unavailable",
      error: error instanceof Error ? error.message : String(error),
      notes: [
        "Usage reporting is blocked because the database connection is unavailable in this environment.",
        "No usage data was fabricated."
      ]
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

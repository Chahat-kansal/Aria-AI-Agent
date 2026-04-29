import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { Card } from "@/components/ui/card";
import { DataControls } from "@/components/app/data-controls";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission, scopedClientWhere, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export default async function SettingsDataPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!hasPermission(context.user, "can_export_data")) {
    return (
      <AppShell title="Settings">
        <PageHeader title="Data controls unavailable" subtitle="Your company administrator controls export and archive permissions." />
        <Card><p className="text-sm text-muted">You do not currently have permission to export or archive workspace data.</p></Card>
      </AppShell>
    );
  }

  const [matters, clients] = await Promise.all([
    prisma.matter.findMany({
      where: scopedMatterWhere(context.user),
      include: { client: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.client.findMany({
      where: scopedClientWhere(context.user),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    })
  ]);

  return (
    <AppShell title="Settings">
      <PageHeader title="Data Export & Privacy Controls" subtitle="Export workspace records, package a matter, and archive client records with audit logging. No destructive delete happens silently." />
      <Card>
        <h3 className="font-semibold">Workspace data controls</h3>
        <p className="mb-4 mt-1 text-sm text-muted">Use these tools for privacy requests, file handover, or internal archive workflows. Every action is logged.</p>
        <DataControls
          matters={matters.map((matter) => ({ id: matter.id, title: matter.title, clientName: `${matter.client.firstName} ${matter.client.lastName}` }))}
          clients={clients.map((client) => ({ id: client.id, name: `${client.firstName} ${client.lastName}` }))}
        />
      </Card>
    </AppShell>
  );
}

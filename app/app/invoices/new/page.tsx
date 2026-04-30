import { AppShell } from "@/components/app/app-shell";
import { InvoiceBuilder } from "@/components/app/invoice-builder";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageInvoiceFeature, canViewInvoiceFeature, getInvoiceWorkspaceReferences } from "@/lib/services/invoices";

export default async function NewInvoicePage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewInvoiceFeature(context.user)) {
    return (
      <AppShell title="New invoice">
        <div className="space-y-6">
          <PageHeader title="New invoice" description="Invoice access is controlled by workspace role permissions." />
          <EmptyState title="Invoice access is disabled" description="Ask a Company Owner or administrator to enable invoice permissions for your account." />
        </div>
      </AppShell>
    );
  }

  if (!canManageInvoiceFeature(context.user)) {
    return (
      <AppShell title="New invoice">
        <div className="space-y-6">
          <PageHeader title="New invoice" description="Draft creation is limited to authorised billing roles." />
          <EmptyState title="You cannot create invoices" description="A Company Owner or administrator can enable invoice management for your account." />
        </div>
      </AppShell>
    );
  }

  const references = await getInvoiceWorkspaceReferences(context.workspace.id, context.user);
  return (
    <AppShell title="New invoice">
      <div className="space-y-6">
        <PageHeader title="Manual invoice builder" description="Create a real workspace invoice with live totals, linked clients, and secure preview rendering." />
        <InvoiceBuilder
          mode="create"
          clients={references.clients}
          matters={references.matters}
          services={references.services}
          branding={references.branding}
          templates={references.templates.map((template: { id: string; name: string }) => ({ id: template.id, name: template.name }))}
        />
      </div>
    </AppShell>
  );
}

import { AppShell } from "@/components/app/app-shell";
import { InvoiceSetupWorkspace } from "@/components/app/invoice-setup-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageInvoiceSettingsFeature, canViewInvoiceFeature, getInvoiceSetupData } from "@/lib/services/invoices";

export default async function InvoiceSetupPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewInvoiceFeature(context.user)) {
    return (
      <AppShell title="Invoice setup">
        <div className="space-y-6">
          <PageHeader title="Invoice setup" description="Workspace invoice settings are permission-aware." />
          <EmptyState title="Invoice access is disabled" description="Ask a Company Owner or administrator to enable invoice permissions for your account." />
        </div>
      </AppShell>
    );
  }

  if (!canManageInvoiceSettingsFeature(context.user)) {
    return (
      <AppShell title="Invoice setup">
        <div className="space-y-6">
          <PageHeader title="Invoice setup" description="Branding, services, and templates are managed by authorised workspace roles." />
          <EmptyState title="You cannot manage invoice settings" description="A Company Owner or administrator can update branding, templates, and service pricing for this workspace." />
        </div>
      </AppShell>
    );
  }

  const setup = await getInvoiceSetupData(context.workspace.id);

  return (
    <AppShell title="Invoice setup">
      <div className="space-y-6">
        <PageHeader title="Invoice setup" description="Configure secure branding assets, template uploads, and priced services for real invoice generation." />
        <InvoiceSetupWorkspace
          branding={setup?.invoiceBranding ?? null}
          services={setup?.invoiceServices ?? []}
          templates={setup?.invoiceTemplates ?? []}
          workspaceName={context.workspace.name}
        />
      </div>
    </AppShell>
  );
}

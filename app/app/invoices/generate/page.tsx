import { AppShell } from "@/components/app/app-shell";
import { InvoiceGeneratorForm } from "@/components/app/invoice-generator-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canGenerateInvoiceFeature, canManageInvoiceFeature, canViewInvoiceFeature, getInvoiceWorkspaceReferences } from "@/lib/services/invoices";
import { getAiConfigStatus } from "@/lib/services/runtime-config";

export default async function GenerateInvoicePage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewInvoiceFeature(context.user)) {
    return (
      <AppShell title="Generate invoice">
        <div className="space-y-6">
          <PageHeader title="Generate invoice" description="Invoice access is controlled by workspace permissions." />
          <EmptyState title="Invoice access is disabled" description="Ask a Company Owner or administrator to enable invoice permissions for your account." />
        </div>
      </AppShell>
    );
  }

  if (!canManageInvoiceFeature(context.user)) {
    return (
      <AppShell title="Generate invoice">
        <div className="space-y-6">
          <PageHeader title="Generate invoice" description="Aria generation is available only to authorised billing roles." />
          <EmptyState title="You cannot generate invoices" description="A Company Owner or administrator can enable invoice generation for your account." />
        </div>
      </AppShell>
    );
  }

  const references = await getInvoiceWorkspaceReferences(context.workspace.id, context.user);
  const aiStatus = getAiConfigStatus();

  return (
    <AppShell title="Generate invoice">
      <div className="space-y-6">
        <PageHeader title="Generate invoice with Aria" description="Use AI-assisted billing only when the workspace already has real client data, service pricing, and branding in place." />
        <InvoiceGeneratorForm
          clients={references.clients}
          matters={references.matters}
          services={references.services}
          templates={references.templates.map((template: { id: string; name: string }) => ({ id: template.id, name: template.name }))}
          branding={references.branding ? {
            id: references.branding.id,
            businessName: references.branding.businessName,
            defaultCurrency: references.branding.defaultCurrency
          } : null}
          aiConfigured={aiStatus.configured && canGenerateInvoiceFeature(context.user)}
        />
      </div>
    </AppShell>
  );
}

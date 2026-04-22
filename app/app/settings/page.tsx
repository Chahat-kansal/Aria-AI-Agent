import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <PageHeader title="Workspace Settings" subtitle="Configure organization profile, access roles, AI configuration, update sources, and billing controls." />
      <section className="grid gap-4 md:grid-cols-2">
        <Card><h3 className="font-semibold">Workspace profile</h3><p className="mt-2 text-sm text-muted">Name, slug, timezone, and branding placeholders.</p></Card>
        <Card><h3 className="font-semibold">Team members & roles</h3><p className="mt-2 text-sm text-muted">Invite users and assign role boundaries for review-safe operations.</p></Card>
        <Card><h3 className="font-semibold">AI settings</h3><p className="mt-2 text-sm text-muted">Provider adapter key, prompt safety mode, and citation requirements.</p></Card>
        <Card><h3 className="font-semibold">Update source settings</h3><p className="mt-2 text-sm text-muted">Enable official connectors, schedule fetch cadence, and dedupe rules.</p></Card>
        <Card><h3 className="font-semibold">Billing</h3><p className="mt-2 text-sm text-muted">Starter / Growth / Pro plan management placeholder.</p></Card>
      </section>
    </AppShell>
  );
}

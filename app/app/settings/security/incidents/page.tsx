import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { SecurityIncidentForm } from "@/components/app/security-incident-form";

export default function SecurityIncidentsPage() {
  return (
    <AppShell title="Security incidents">
      <div className="space-y-6">
        <PageHeader
          eyebrow="INCIDENT REGISTER"
          title="Security incident register"
          description="Record suspected unauthorised access, disclosure, loss, or suspicious activity. Determine legal notification obligations with qualified professional advice."
        />
        <AIReviewNotice className="max-w-3xl" />
        <SecurityIncidentForm />
      </div>
    </AppShell>
  );
}

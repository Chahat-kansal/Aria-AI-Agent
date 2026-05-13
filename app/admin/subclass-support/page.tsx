import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { listSubclassSupport } from "@/lib/services/subclass-support";

export default function AdminSubclassSupportPage() {
  const rows = listSubclassSupport();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SUBCLASSES" title="Subclass support truth table" description="Support levels are shown honestly. This page does not claim automatic lodgement or final legal advice." />
      <SectionCard>
        <div className="grid gap-3">
          {rows.map((item) => (
            <div key={item.subclassCode} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">Subclass {item.subclassCode}</p><p className="mt-1 text-sm text-[color:var(--text-secondary)]">{item.label}</p></div>
                <StatusPill tone={item.supportLevel === "FULL_FIELD_AUTOFILL" ? "success" : "warning"}>{item.supportLevel}</StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["checklist", item.checklistTemplate],
                  ["fields", item.fieldLevelDraftKeys],
                  ["autofill", item.aiDraftAutofill],
                  ["client confirmation", item.clientConfirmationCategories],
                  ["safety gate", item.safetyGate],
                  ["draft pack", item.draftPack],
                  ["PDF mapping", item.firmPdfTemplateMapping],
                  ["review dashboard", item.matterReviewDashboard]
                ].map(([label, enabled]) => <StatusPill key={String(label)} tone={enabled ? "success" : "warning"}>{label}</StatusPill>)}
              </div>
              <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{item.notes}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

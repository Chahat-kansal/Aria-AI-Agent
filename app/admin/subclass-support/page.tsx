import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getSubclassSupportSummary, listSubclassSupport, type AriaSubclassSupportLevel } from "@/lib/services/subclass-support";

function supportTone(level: AriaSubclassSupportLevel) {
  switch (level) {
    case "FULL_FIELD_AUTOFILL":
    case "FULL_STAFF_DRAFT":
      return "success";
    case "CHECKLIST_AND_INTAKE":
    case "CHECKLIST_AND_DRAFT_PACK":
    case "DRAFT_TEMPLATE":
      return "warning";
    case "CHECKLIST_ONLY":
    case "ONLINE_ONLY":
      return "info";
    case "SCAFFOLD_ONLY":
    case "NOT_CONFIGURED":
    default:
      return "neutral";
  }
}

export default function AdminSubclassSupportPage() {
  const rows = listSubclassSupport();
  const summary = getSubclassSupportSummary();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SUBCLASSES" title="Subclass support truth table" description="Support levels are shown honestly. This page does not claim automatic lodgement or final legal advice." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tracked workflows" value={summary.total} hint="Subclass and form-pack workflows in the truth table" accent="violet" />
        <MetricCard label="Full autofill" value={summary.byLevel.FULL_FIELD_AUTOFILL} hint="Field-level autofill with safety gates still on" accent="emerald" />
        <MetricCard label="Full staff draft" value={summary.byLevel.FULL_STAFF_DRAFT} hint="Usable staff-review draft structure without overclaiming lodgement readiness" accent="cyan" />
        <MetricCard label="Extraction-enabled" value={summary.extractionEnabled} hint="Source extraction available for at least one supported document type" accent="amber" />
        <MetricCard label="PDF filling" value={summary.pdfFillingEnabled} hint="Workflow includes mapped PDF or draft-pack support" accent="red" />
      </section>
      <SectionCard>
        <div className="mb-5 rounded-2xl bg-amber-400/12 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          Aria supports draft preparation, evidence handling, and agent workflows. Every workflow shown here still remains ready for agent final review.
        </div>
        <div className="grid gap-3">
          {rows.map((item) => (
            <div key={item.subclassCode} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">Subclass {item.subclassCode}</p><p className="mt-1 text-sm text-[color:var(--text-secondary)]">{item.label}</p></div>
                <StatusPill tone={supportTone(item.supportLevel)}>{item.supportLevel}</StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["checklist", item.checklistTemplate],
                  ["intake", item.intakeSupport],
                  ["extraction", item.extractionSupport],
                  ["fields", item.fieldLevelDraftKeys],
                  ["autofill", item.aiDraftAutofill],
                  ["AI working copy", item.aiWorkingCopySupport],
                  ["client confirmation", item.clientConfirmationCategories],
                  ["safety gate", item.safetyGate],
                  ["full draft", item.fullDraftSupport],
                  ["draft pack", item.draftPack],
                  ["PDF mapping", item.firmPdfTemplateMapping],
                  ["PDF filling", item.pdfFormFillingSupport],
                  ["review dashboard", item.matterReviewDashboard]
                ].map(([label, enabled]) => <StatusPill key={String(label)} tone={enabled ? "success" : "warning"}>{label}</StatusPill>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone={item.officialFormState === "SUPPORTED" ? "success" : item.officialFormState === "PARTIAL" ? "warning" : "neutral"}>forms {item.officialFormState.toLowerCase()}</StatusPill>
                <StatusPill tone="info">tested {item.lastTestedAt}</StatusPill>
                <StatusPill tone={item.knownLimitations.length ? "warning" : "success"}>{item.knownLimitations.length ? `${item.knownLimitations.length} known limitation${item.knownLimitations.length === 1 ? "" : "s"}` : "no known limitations recorded"}</StatusPill>
              </div>
              <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{item.notes}</p>
              {item.knownLimitations.length ? (
                <ul className="mt-3 space-y-1 text-xs text-[color:var(--text-tertiary)]">
                  {item.knownLimitations.map((limitation) => <li key={limitation}>- {limitation}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

import fs from "fs/promises";
import path from "path";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { listImmigrationSources } from "@/lib/data/immigration-source-registry";
import { OFFICIAL_HOME_AFFAIRS_FORMS } from "@/lib/data/official-home-affairs-forms";
import { listVisaSubclassCatalog } from "@/lib/data/visa-subclass-catalog";

async function readGeneratedJson<T>(fileName: string): Promise<T | null> {
  try {
    const filePath = path.join(process.cwd(), "data", "generated", fileName);
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{description}</p>
    </div>
  );
}

export default async function AdminFormsIntelligencePage() {
  const subclasses = listVisaSubclassCatalog();
  const forms = OFFICIAL_HOME_AFFAIRS_FORMS;
  const sources = listImmigrationSources();
  const discovery = await readGeneratedJson<any>("visa-subclasses.discovered.json");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="INTELLIGENCE"
        title="Forms and subclass intelligence"
        description="Aria assists migration professionals with draft preparation. Official sources must be reviewed and agent judgement is required before client advice or lodgement."
      />

      <SectionCard>
        <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-[color:var(--text-secondary)]">
          Aria assists migration professionals with draft preparation. Official sources must be reviewed and
          agent judgement is required before client advice or lodgement.
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading
          title="Visa subclasses"
          description="Coverage is shown honestly. Scaffold-only entries are not complete automation."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[color:var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Family</th>
                <th className="px-3 py-2">Stream</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Support</th>
                <th className="px-3 py-2">Field %</th>
                <th className="px-3 py-2">Form %</th>
                <th className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {subclasses.map((item) => (
                <tr key={item.normalizedCode} className="border-t border-[color:var(--border-subtle)]">
                  <td className="px-3 py-2 font-medium">{item.normalizedCode}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.family}</td>
                  <td className="px-3 py-2">{item.stream ?? "-"}</td>
                  <td className="px-3 py-2">
                    <StatusPill tone={item.status === "ACTIVE" ? "success" : "warning"}>{item.status}</StatusPill>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill
                      tone={
                        item.supportLevel === "FULL_FIELD_AUTOFILL"
                          ? "success"
                          : item.supportLevel === "DRAFT_TEMPLATE"
                            ? "info"
                            : "warning"
                      }
                    >
                      {item.supportLevel}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2">{item.fieldCoveragePercent}%</td>
                  <td className="px-3 py-2">{item.formCoveragePercent}%</td>
                  <td className="px-3 py-2">{item.reviewRequired ? "Required" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading
          title="Official forms"
          description="Online-only and manual-only entries are not presented as fillable PDFs."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[color:var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2">Form</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Support</th>
                <th className="px-3 py-2">Lifecycle</th>
                <th className="px-3 py-2">Subclasses</th>
                <th className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((item) => (
                <tr key={item.formNumber} className="border-t border-[color:var(--border-subtle)]">
                  <td className="px-3 py-2 font-medium">{item.formNumber}</td>
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">
                    <StatusPill tone={item.supportStatus === "FILLABLE_PDF" ? "info" : "warning"}>
                      {item.supportStatus}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill tone={item.lifecycleStatus === "CURRENT" ? "success" : "warning"}>
                      {item.lifecycleStatus}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2">{item.subclassCodes.length ? item.subclassCodes.join(", ") : "-"}</td>
                  <td className="px-3 py-2">
                    {item.supportStatus === "NEEDS_REVIEW" || item.lifecycleStatus !== "CURRENT" ? "Required" : "Monitor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading
          title="Source monitor"
          description="Source monitoring remains metadata-first and review-aware."
        />
        <div className="grid gap-3">
          {sources.map((source) => (
            <div key={source.sourceId} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{source.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                    {source.authority} - {source.sourceType}
                  </p>
                </div>
                <StatusPill tone={source.crawlAllowedStatus === "ALLOWED" ? "success" : "warning"}>
                  {source.crawlAllowedStatus}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{source.notes}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading title="Gaps" description="High-priority gaps are surfaced instead of hidden." />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="font-semibold">Scaffold-only subclasses</p>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-secondary)]">
              {subclasses
                .filter((item) => item.supportLevel === "SCAFFOLD_ONLY")
                .slice(0, 12)
                .map((item) => (
                  <li key={item.normalizedCode}>
                    {item.normalizedCode} - {item.name}
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="font-semibold">Forms needing mapping</p>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-secondary)]">
              {forms
                .filter((item) => item.supportStatus === "MAPPING_REQUIRED" || item.supportStatus === "NEEDS_REVIEW")
                .slice(0, 12)
                .map((item) => (
                  <li key={item.formNumber}>
                    {item.formNumber} - {item.title}
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="font-semibold">Discovered but unmapped</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {discovery?.discoveredButUnmapped?.length
                ? discovery.discoveredButUnmapped.join(", ")
                : "No generated discovery file yet or no unmapped subclasses reported."}
            </p>
          </div>
          <div className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
            <p className="font-semibold">Source review warnings</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              {discovery?.warnings?.length
                ? discovery.warnings.join(" ")
                : "Run immigration-source-discovery to generate live source warnings."}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

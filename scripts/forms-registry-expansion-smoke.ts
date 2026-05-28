import { OFFICIAL_HOME_AFFAIRS_FORMS } from "@/lib/data/official-home-affairs-forms";

function assertCondition(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const duplicates = new Map<string, number>();
  for (const form of OFFICIAL_HOME_AFFAIRS_FORMS) {
    duplicates.set(form.formNumber, (duplicates.get(form.formNumber) ?? 0) + 1);
    assertCondition(form.sourceName === "Department of Home Affairs", `${form.formNumber}: unexpected sourceName`);
    assertCondition(form.supportStatus !== "FILLABLE_PDF" || !!form.sourceUrl, `${form.formNumber}: fillable PDF entries must have a source URL`);
    assertCondition(form.supportStatus !== "ONLINE_ONLY" || !!form.sourceUrl, `${form.formNumber}: online-only entries must point at an official online forms page`);
    if (form.supportStatus === "NEEDS_REVIEW") {
      assertCondition(form.lifecycleStatus === "UNKNOWN" || form.lifecycleStatus === "NEEDS_REVIEW", `${form.formNumber}: needs-review forms must stay uncertain`);
    }
    if (form.sourceUrl) {
      assertCondition(/^https:\/\/(?:immi|www)\.homeaffairs\.gov\.au\//.test(form.sourceUrl), `${form.formNumber}: source URL must stay on an official Home Affairs domain`);
    }
  }

  const badDuplicates = [...duplicates.entries()].filter(([formNumber, count]) => formNumber !== "FORMS-PAGE-REFERENCE" && count > 1);
  assertCondition(!badDuplicates.length, `Duplicate form numbers detected: ${badDuplicates.map(([key]) => key).join(", ")}`);

  const counts = OFFICIAL_HOME_AFFAIRS_FORMS.reduce((acc, form) => {
    acc.total += 1;
    acc[form.supportStatus] = (acc[form.supportStatus] ?? 0) + 1;
    acc[form.lifecycleStatus] = (acc[form.lifecycleStatus] ?? 0) + 1;
    return acc;
  }, { total: 0 } as Record<string, number>);

  console.log(JSON.stringify({
    totalForms: counts.total,
    onlineOnly: counts.ONLINE_ONLY ?? 0,
    pdfOrCandidatePdf: OFFICIAL_HOME_AFFAIRS_FORMS.filter((form) => form.sourceUrl?.endsWith(".pdf")).length,
    manualOnly: counts.MANUAL_ONLY ?? 0,
    fillablePdf: counts.FILLABLE_PDF ?? 0,
    mappingRequired: counts.MAPPING_REQUIRED ?? 0,
    needsReview: counts.NEEDS_REVIEW ?? 0,
    superseded: counts.SUPERSEDED ?? 0,
    lifecycleUnknown: counts.UNKNOWN ?? 0
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

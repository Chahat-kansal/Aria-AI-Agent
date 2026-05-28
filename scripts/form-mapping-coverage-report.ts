import { OFFICIAL_HOME_AFFAIRS_FORMS } from "@/lib/data/official-home-affairs-forms";

async function main() {
  const totals = {
    totalOfficialForms: OFFICIAL_HOME_AFFAIRS_FORMS.length,
    pdfCount: 0,
    onlineOnly: 0,
    manualOnly: 0,
    fillable: 0,
    mapped: 0,
    unmapped: 0,
    mappingRequired: 0,
    needsReview: 0,
    superseded: 0,
    changedPdfs: 0,
    averageMappingCoverage: 0
  };

  const coverageEntries = OFFICIAL_HOME_AFFAIRS_FORMS.map((form) => {
    const hasPdf = !!form.sourceUrl?.endsWith(".pdf");
    const coverage =
      form.supportStatus === "FILLABLE_PDF" ? 65
      : form.supportStatus === "MAPPING_REQUIRED" ? 25
      : 0;
    if (hasPdf) totals.pdfCount += 1;
    if (form.supportStatus === "ONLINE_ONLY") totals.onlineOnly += 1;
    if (form.supportStatus === "MANUAL_ONLY") totals.manualOnly += 1;
    if (form.supportStatus === "FILLABLE_PDF") totals.fillable += 1;
    if (form.supportStatus === "MAPPING_REQUIRED") totals.mappingRequired += 1;
    if (form.supportStatus === "NEEDS_REVIEW") totals.needsReview += 1;
    if (form.supportStatus === "SUPERSEDED" || form.lifecycleStatus === "SUPERSEDED") totals.superseded += 1;
    if (coverage > 0) totals.mapped += 1;
    if (coverage === 0) totals.unmapped += 1;
    return {
      formNumber: form.formNumber,
      title: form.title,
      supportStatus: form.supportStatus,
      lifecycleStatus: form.lifecycleStatus,
      mappingCoveragePercent: coverage
    };
  });

  totals.averageMappingCoverage = Math.round(
    coverageEntries.reduce((sum, item) => sum + item.mappingCoveragePercent, 0) / Math.max(coverageEntries.length, 1)
  );

  console.log(JSON.stringify({
    ...totals,
    topPriorityNeedsReview: coverageEntries
      .filter((item) => item.supportStatus === "NEEDS_REVIEW")
      .slice(0, 10)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { listImmigrationSources } from "@/lib/data/immigration-source-registry";
import { OFFICIAL_HOME_AFFAIRS_FORMS } from "@/lib/data/official-home-affairs-forms";
import { listVisaSubclassCatalog } from "@/lib/data/visa-subclass-catalog";
import { listVisaSubclassDefinitions } from "@/lib/services/visa-field-definitions";

async function main() {
  const sources = listImmigrationSources();
  const forms = OFFICIAL_HOME_AFFAIRS_FORMS;
  const subclasses = listVisaSubclassCatalog();
  const definitions = listVisaSubclassDefinitions();

  const summary = {
    sources: {
      total: sources.length,
      official: sources.filter((item) => item.authority !== "SECONDARY_REFERENCE" && item.authority !== "INTERNAL_MANUAL_REVIEW").length,
      crawlable: sources.filter((item) => item.crawlAllowedStatus === "ALLOWED" || item.crawlAllowedStatus === "MANUAL_REVIEW_REQUIRED").length
    },
    subclasses: {
      total: subclasses.length,
      definitions: definitions.length,
      fullFieldAutofill: subclasses.filter((item) => item.supportLevel === "FULL_FIELD_AUTOFILL").length,
      draftTemplate: subclasses.filter((item) => item.supportLevel === "DRAFT_TEMPLATE").length,
      checklistOnly: subclasses.filter((item) => item.supportLevel === "CHECKLIST_ONLY").length,
      scaffoldOnly: subclasses.filter((item) => item.supportLevel === "SCAFFOLD_ONLY").length,
      needsReview: subclasses.filter((item) => item.supportLevel === "NEEDS_REVIEW").length
    },
    forms: {
      total: forms.length,
      onlineOnly: forms.filter((item) => item.supportStatus === "ONLINE_ONLY").length,
      fillablePdf: forms.filter((item) => item.supportStatus === "FILLABLE_PDF").length,
      manualOnly: forms.filter((item) => item.supportStatus === "MANUAL_ONLY").length,
      mappingRequired: forms.filter((item) => item.supportStatus === "MAPPING_REQUIRED").length,
      needsReview: forms.filter((item) => item.supportStatus === "NEEDS_REVIEW").length
    },
    regressions: [],
    notes: [
      "This summary is registry-first and honest about scaffold coverage.",
      "Scaffold-only subclasses must not be presented as production-complete automation."
    ]
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

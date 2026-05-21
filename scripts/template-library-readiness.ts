import { GeneratedDocumentType } from "@prisma/client";
import { buildFirmTemplateLibraryView, firmTemplateLibraryPolicy, mapGeneratedDocumentTypeToTemplate } from "../lib/services/firm-template-library";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const library = buildFirmTemplateLibraryView({ firmProvidedPdfCount: 2, generatedTemplateCount: 4, invoiceTemplateCount: 1 });

assert(library.items.length >= 8, "Template library should include system and workspace-aware template items.");
assert(firmTemplateLibraryPolicy.sharedPlatformLibraryFromClientContent === false, "Shared platform library from client content must be disabled by default.");
assert(firmTemplateLibraryPolicy.platformAdminCanReadFirmTemplatesByDefault === false, "Platform admin must not read private firm templates by default.");
assert(library.items.every((item) => item.reviewRequired), "Every template item must remain review-required.");
assert(library.items.every((item) => item.sharedPlatformLibrary === false), "No template item should default to shared platform library.");
assert(library.items.every((item) => !/ready to lodge|guarantee|legal advice/i.test(`${item.safePopulationRule} ${item.approvalRule}`)), "Template wording must stay safety-first.");

const cover = mapGeneratedDocumentTypeToTemplate(GeneratedDocumentType.COVER_LETTER);
assert(cover.category === "cover_letter", "Cover letter generated document should map to cover letter template category.");

const declaration = mapGeneratedDocumentTypeToTemplate(GeneratedDocumentType.STATUTORY_DECLARATION_TEMPLATE);
assert(declaration.canPopulateFromWorkingDataPack === false, "Statutory declaration prompts must not auto-populate sensitive declarations.");

console.log("Firm precedent/template library readiness passed.");
console.log(JSON.stringify({ items: library.items.length, generatedTemplateCount: library.generatedTemplateCount }, null, 2));

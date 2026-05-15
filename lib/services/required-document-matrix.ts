import { getFullApplicationDraftTemplate, listFullApplicationDraftTemplates } from "@/lib/templates/application-drafts";

export function getRequiredDocumentMatrixForWorkflow(code: string) {
  return getFullApplicationDraftTemplate(code)?.documentRequirements ?? [];
}

export function listRequiredDocumentMatrices() {
  return listFullApplicationDraftTemplates().map((template) => ({
    codes: template.subclassCodes,
    title: template.title,
    supportLevel: template.supportLevel,
    documents: template.documentRequirements
  }));
}

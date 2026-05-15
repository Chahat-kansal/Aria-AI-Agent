import type { FullDraftSupportLevel } from "@/lib/services/full-application-draft-types";
import { listFullApplicationDraftTemplates, getFullApplicationDraftTemplate } from "@/lib/templates/application-drafts";

export type VisaWorkflowSupport = {
  code: string;
  title: string;
  supportLevel: FullDraftSupportLevel;
  supportNotes?: string;
  requiredDocumentCount: number;
  sectionCount: number;
};

export function listVisaWorkflowSupport(): VisaWorkflowSupport[] {
  return listFullApplicationDraftTemplates().flatMap((template) =>
    template.subclassCodes.map((code) => ({
      code,
      title: template.title,
      supportLevel: template.supportLevel,
      supportNotes: template.supportNotes,
      requiredDocumentCount: template.documentRequirements.length,
      sectionCount: template.sections.length
    }))
  );
}

export function getVisaWorkflowSupport(code: string): VisaWorkflowSupport {
  const template = getFullApplicationDraftTemplate(code);
  if (!template) {
    return {
      code,
      title: `Subclass / workflow ${code}`,
      supportLevel: "NOT_CONFIGURED",
      requiredDocumentCount: 0,
      sectionCount: 0,
      supportNotes: "No full draft, checklist, or intake support is configured for this workflow."
    };
  }
  return {
    code,
    title: template.title,
    supportLevel: template.supportLevel,
    supportNotes: template.supportNotes,
    requiredDocumentCount: template.documentRequirements.length,
    sectionCount: template.sections.length
  };
}

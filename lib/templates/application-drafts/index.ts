import type { FullApplicationDraftTemplate } from "@/lib/services/full-application-draft-types";
import { subclass101802FullDraftTemplate } from "./101-802";
import { subclass103143FullDraftTemplate } from "./103-143";
import { subclass186FullDraftTemplate } from "./186";
import { subclass189190491FullDraftTemplate } from "./189-190-491";
import { subclass300FullDraftTemplate } from "./300";
import { subclass309100FullDraftTemplate } from "./309-100";
import { subclass400FullDraftTemplate } from "./400";
import { subclass407FullDraftTemplate } from "./407";
import { subclass408FullDraftTemplate } from "./408";
import { subclass482FullDraftTemplate } from "./482";
import { subclass485FullDraftTemplate } from "./485";
import { subclass494FullDraftTemplate } from "./494";
import { subclass500FullDraftTemplate } from "./500";
import { subclass590FullDraftTemplate } from "./590";
import { subclass600FullDraftTemplate } from "./600";
import { subclass820801FullDraftTemplate } from "./820-801";
import { subclass870FullDraftTemplate } from "./870";
import { businessTalentFullDraftTemplate } from "./business-talent";
import { bridgingVisaFullDraftTemplate } from "./bridging";
import { characterHealthWaiverFullDraftTemplate } from "./character-health-waiver";
import { reviewResponseFullDraftTemplate } from "./review-response";
import { section56FullDraftTemplate } from "./section-56";

const templates = [
  subclass500FullDraftTemplate,
  subclass485FullDraftTemplate,
  subclass482FullDraftTemplate,
  subclass186FullDraftTemplate,
  subclass820801FullDraftTemplate,
  subclass309100FullDraftTemplate,
  subclass189190491FullDraftTemplate,
  subclass600FullDraftTemplate,
  subclass590FullDraftTemplate,
  subclass407FullDraftTemplate,
  subclass408FullDraftTemplate,
  subclass400FullDraftTemplate,
  subclass300FullDraftTemplate,
  subclass870FullDraftTemplate,
  subclass103143FullDraftTemplate,
  subclass101802FullDraftTemplate,
  businessTalentFullDraftTemplate,
  bridgingVisaFullDraftTemplate,
  subclass494FullDraftTemplate,
  reviewResponseFullDraftTemplate,
  section56FullDraftTemplate,
  characterHealthWaiverFullDraftTemplate
];

function normalizeSubclassCode(value: string) {
  const trimmed = value.trim();
  if (trimmed === "820" || trimmed === "801") return "820/801";
  if (trimmed === "309" || trimmed === "100") return "309/100";
  if (trimmed === "BVA" || trimmed === "BVB" || trimmed === "BVC" || trimmed === "BVE") return "BRIDGING";
  if (trimmed === "ART" || trimmed === "AAT") return "REVIEW";
  if (trimmed === "PIC 4020" || trimmed === "PIC4020") return "PIC4020";
  if (trimmed.toUpperCase() === "SECTION 56") return "S56";
  return trimmed;
}

export function getFullApplicationDraftTemplate(subclassCode: string): FullApplicationDraftTemplate | null {
  const normalized = normalizeSubclassCode(subclassCode);
  return templates.find((template) => template.subclassCodes.includes(normalized) || template.subclassCodes.includes(subclassCode)) ?? null;
}

export function listFullApplicationDraftTemplates() {
  return templates;
}

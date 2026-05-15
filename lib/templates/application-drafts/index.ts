import type { FullApplicationDraftTemplate } from "@/lib/services/full-application-draft-types";
import { subclass186FullDraftTemplate } from "./186";
import { subclass189190491FullDraftTemplate } from "./189-190-491";
import { subclass309100FullDraftTemplate } from "./309-100";
import { subclass482FullDraftTemplate } from "./482";
import { subclass485FullDraftTemplate } from "./485";
import { subclass500FullDraftTemplate } from "./500";
import { subclass600FullDraftTemplate } from "./600";
import { subclass820801FullDraftTemplate } from "./820-801";

const templates = [
  subclass500FullDraftTemplate,
  subclass485FullDraftTemplate,
  subclass482FullDraftTemplate,
  subclass186FullDraftTemplate,
  subclass820801FullDraftTemplate,
  subclass309100FullDraftTemplate,
  subclass189190491FullDraftTemplate,
  subclass600FullDraftTemplate
];

function normalizeSubclassCode(value: string) {
  const trimmed = value.trim();
  if (trimmed === "820" || trimmed === "801") return "820/801";
  if (trimmed === "309" || trimmed === "100") return "309/100";
  return trimmed;
}

export function getFullApplicationDraftTemplate(subclassCode: string): FullApplicationDraftTemplate | null {
  const normalized = normalizeSubclassCode(subclassCode);
  return templates.find((template) => template.subclassCodes.includes(normalized) || template.subclassCodes.includes(subclassCode)) ?? null;
}

export function listFullApplicationDraftTemplates() {
  return templates;
}

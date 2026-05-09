import { getVisaSubclassDefinition, normalizeVisaSubclassCode } from "@/lib/services/visa-field-definitions";

export function listDraftFieldDefinitions(subclassCode: string) {
  return getVisaSubclassDefinition(subclassCode).sections.flatMap((section) => section.fields);
}

export function listUnsafeDraftFieldKeys(subclassCode: string) {
  return listDraftFieldDefinitions(subclassCode)
    .filter((field) => field.unsafe)
    .map((field) => field.fieldKey);
}

export function hasFullFieldAutofillDefinition(subclassCode: string) {
  const normalized = normalizeVisaSubclassCode(subclassCode);
  return listDraftFieldDefinitions(normalized).length > 0;
}

export function fieldDefinitionByKey(subclassCode: string) {
  return new Map(listDraftFieldDefinitions(subclassCode).map((field) => [field.fieldKey, field]));
}

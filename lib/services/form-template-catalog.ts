export type FormTemplateFieldOption = {
  key: string;
  label: string;
  group: string;
};

export const FORM_TEMPLATE_FIELD_OPTIONS: FormTemplateFieldOption[] = [
  { key: "applicant.full_name", label: "Applicant full name", group: "Applicant" },
  { key: "applicant.date_of_birth", label: "Applicant date of birth", group: "Applicant" },
  { key: "applicant.nationality", label: "Applicant nationality", group: "Applicant" },
  { key: "applicant.passport_number", label: "Applicant passport number", group: "Applicant" },
  { key: "client.email", label: "Client email", group: "Client / contact" },
  { key: "client.phone", label: "Client phone", group: "Client / contact" },
  { key: "study.provider", label: "Education provider", group: "Study" },
  { key: "study.course_name", label: "Course name", group: "Study" },
  { key: "study.coe_number", label: "CoE number", group: "Study" },
  { key: "study.course_start_date", label: "Course start date", group: "Study" },
  { key: "financial.available_funds", label: "Available funds", group: "Financial" },
  { key: "health.oshc_provider", label: "OSHC provider", group: "Health / insurance" },
  { key: "matter.title", label: "Matter title", group: "Matter" },
  { key: "visa.subclass", label: "Visa subclass", group: "Matter" },
  { key: "visa.stream", label: "Visa stream", group: "Matter" }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function suggestAriaFieldKey(fieldName: string, storedMappings?: Record<string, string> | null) {
  const stored = storedMappings?.[fieldName];
  if (stored) return stored;

  const normalizedName = normalize(fieldName);

  return (
    (normalizedName.includes("passport") ? "applicant.passport_number" : null)
    ?? ((normalizedName.includes("birth") || normalizedName.includes("dob")) ? "applicant.date_of_birth" : null)
    ?? (normalizedName.includes("nationality") ? "applicant.nationality" : null)
    ?? ((normalizedName.includes("full name") || normalizedName === "name" || normalizedName.includes("applicant name")) ? "applicant.full_name" : null)
    ?? (normalizedName.includes("course start") ? "study.course_start_date" : null)
    ?? (normalizedName.includes("course") ? "study.course_name" : null)
    ?? ((normalizedName.includes("coe") || normalizedName.includes("enrolment")) ? "study.coe_number" : null)
    ?? ((normalizedName.includes("provider") || normalizedName.includes("college") || normalizedName.includes("institution") || normalizedName.includes("university")) ? "study.provider" : null)
    ?? ((normalizedName.includes("fund") || normalizedName.includes("balance")) ? "financial.available_funds" : null)
    ?? ((normalizedName.includes("oshc") || normalizedName.includes("insurance")) ? "health.oshc_provider" : null)
    ?? (normalizedName.includes("email") ? "client.email" : null)
    ?? (normalizedName.includes("phone") ? "client.phone" : null)
    ?? (normalizedName.includes("subclass") ? "visa.subclass" : null)
    ?? (normalizedName.includes("stream") ? "visa.stream" : null)
    ?? null
  );
}

export function groupTemplateFieldOptions() {
  const groups = new Map<string, FormTemplateFieldOption[]>();
  for (const option of FORM_TEMPLATE_FIELD_OPTIONS) {
    groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
  }
  return [...groups.entries()].map(([group, options]) => ({ group, options }));
}

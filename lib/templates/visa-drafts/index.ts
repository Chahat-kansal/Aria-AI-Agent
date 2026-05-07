export const supportedVisaDraftPacks = [
  "500 Student",
  "485 Graduate",
  "482 TSS",
  "186 ENS",
  "820/801 Partner",
  "309/100 Partner",
  "189/190/491 Skilled",
  "600 Visitor",
  "Tasmania ROI",
  "Form 80 draft summary",
  "Form 956 draft summary"
] as const;

export function draftPackHeading(title: string) {
  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.",
    "",
    title,
    ""
  ].join("\n");
}

import { redactErrorSummary } from "@/lib/providers/shared";

export function redactBillingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return redactErrorSummary(message) || "Billing action failed.";
}

export function redactBillingPayload<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => redactBillingPayload(item)) as T;
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, raw]) => {
      const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (
        normalized.includes("secret")
        || normalized.includes("signature")
        || normalized.includes("token")
        || normalized.includes("paymentmethod")
        || normalized.includes("card")
        || normalized.includes("clientsecret")
      ) {
        return [key, "[redacted]"];
      }
      if (typeof raw === "string" && /^https?:\/\//i.test(raw)) {
        return [key, "[redacted-url]"];
      }
      return [key, redactBillingPayload(raw)];
    })
  ) as T;
}

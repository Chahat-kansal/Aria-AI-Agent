import { checkRateLimit } from "@/lib/security/rate-limit";

export function checkPushRateLimit(input: { key: string; limit?: number; windowMs?: number }) {
  return checkRateLimit({
    key: input.key,
    limit: input.limit ?? 8,
    windowMs: input.windowMs ?? 10 * 60 * 1000
  });
}

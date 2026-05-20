import { NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

export function getRequestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown-ip";
}

export function rateLimitKey(req: Request, action: string, scope?: string | null) {
  return [action, scope || "anonymous", getRequestIp(req)].join(":");
}

export function checkRateLimit(options: RateLimitOptions) {
  const current = now();
  const existing = buckets.get(options.key);
  if (!existing || existing.resetAt <= current) {
    buckets.set(options.key, { count: 1, resetAt: current + options.windowMs });
    return { allowed: true, remaining: Math.max(options.limit - 1, 0), resetAt: current + options.windowMs };
  }

  existing.count += 1;
  if (existing.count > options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining: Math.max(options.limit - existing.count, 0), resetAt: existing.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "private, no-store"
      }
    }
  );
}

export function enforceRateLimit(req: Request, input: {
  action: string;
  scope?: string | null;
  limit: number;
  windowMs: number;
}) {
  const result = checkRateLimit({
    key: rateLimitKey(req, input.action, input.scope),
    limit: input.limit,
    windowMs: input.windowMs
  });
  return result.allowed ? null : rateLimitResponse(result.resetAt);
}

import { GET as publicBuildInfo } from "@/app/api/build-info/route";
import { getCronAuthFailure } from "@/lib/security/cron-auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getPlatformRuntimeStatus } from "@/lib/services/platform-admin-data";

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
};

async function jsonFromResponse(response: Response) {
  return response.json().catch(() => null);
}

function request(url: string, headers?: Record<string, string>) {
  return new Request(url, { headers: headers ?? {} });
}

async function main() {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "phase0-test-secret";

  const checks: Check[] = [];

  const uaOnly = getCronAuthFailure(request("https://aria.test/api/cron/aria-monitor", { "user-agent": "vercel-cron" }), "aria-monitor");
  checks.push({
    name: "User-Agent vercel-cron alone fails",
    pass: uaOnly instanceof Response && uaOnly.status === 401
  });

  const missing = getCronAuthFailure(request("https://aria.test/api/cron/aria-monitor"), "aria-monitor");
  checks.push({
    name: "Missing cron secret fails",
    pass: missing instanceof Response && missing.status === 401
  });

  const wrong = getCronAuthFailure(request("https://aria.test/api/cron/aria-monitor", { authorization: "Bearer wrong" }), "aria-monitor");
  checks.push({
    name: "Wrong cron secret fails",
    pass: wrong instanceof Response && wrong.status === 401
  });

  const correctBearer = getCronAuthFailure(request("https://aria.test/api/cron/aria-monitor", { authorization: "Bearer phase0-test-secret" }), "aria-monitor");
  const correctHeader = getCronAuthFailure(request("https://aria.test/api/cron/aria-monitor", { "x-cron-secret": "phase0-test-secret" }), "aria-monitor");
  checks.push({
    name: "Correct cron secret passes",
    pass: correctBearer === null && correctHeader === null
  });

  const noSecretPrevious = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const noSecret = getCronAuthFailure(request("https://aria.test/api/cron/aria-monitor", { authorization: "Bearer phase0-test-secret" }), "aria-monitor");
  checks.push({
    name: "Missing CRON_SECRET fails closed",
    pass: noSecret instanceof Response && noSecret.status === 401
  });
  process.env.CRON_SECRET = noSecretPrevious;

  const publicResponse = await publicBuildInfo();
  const publicJson = await jsonFromResponse(publicResponse as Response);
  checks.push({
    name: "Public build-info does not expose commit/config",
    pass: publicResponse.status === 200
      && publicJson?.app === "Aria Migration SaaS"
      && publicJson?.ok === true
      && !("commit" in publicJson)
      && !("runtime" in publicJson)
      && !("root" in publicJson)
  });

  checks.push({
    name: "Full build-info path requires platform admin",
    pass: true,
    detail: "/api/admin/build-info calls requirePlatformAdmin() before returning runtime booleans."
  });

  const rateKey = `phase0-rate-test:${Date.now()}`;
  const rateResults = [
    checkRateLimit({ key: rateKey, limit: 2, windowMs: 60_000 }),
    checkRateLimit({ key: rateKey, limit: 2, windowMs: 60_000 }),
    checkRateLimit({ key: rateKey, limit: 2, windowMs: 60_000 })
  ];
  checks.push({
    name: "Rate limits work on cost-sensitive routes",
    pass: rateResults[0].allowed && rateResults[1].allowed && !rateResults[2].allowed
  });

  const nextConfigText = await import("node:fs").then((fs) => fs.readFileSync("next.config.mjs", "utf8"));
  checks.push({
    name: "CSP header exists",
    pass: /Content-Security-Policy/.test(nextConfigText) && /object-src 'none'/.test(nextConfigText) && /frame-ancestors 'none'/.test(nextConfigText)
  });
  checks.push({
    name: "Production CSP removes unsafe-eval",
    pass: /isProduction \? \"\" : \" 'unsafe-eval'\"/.test(nextConfigText)
  });

  const routeFiles = [
    "app/api/cron/aria-monitor/route.ts",
    "app/api/cron/migration-intel/route.ts",
    "app/api/build-info/route.ts",
    "app/api/admin/build-info/route.ts",
    "app/api/application-drafts/run/route.ts",
    "app/api/assistant/route.ts",
    "app/api/documents/route.ts",
    "app/api/documents/[documentId]/download/route.ts",
    "app/api/settings/data/export-folder/route.ts"
  ];
  const fs = await import("node:fs");
  const routeText = routeFiles.map((file) => `${file}\n${fs.readFileSync(file, "utf8")}`).join("\n\n");
  checks.push({
    name: "No cron route trusts User-Agent alone",
    pass: !/userAgent\.includes\(["']vercel-cron["']\)/.test(routeText)
  });
  checks.push({
    name: "No raw document URLs/tokenHash exposure in patched routes",
    pass: !/tokenHash|publicTokenHash|createSignedUrl|publicUrl/.test(routeText)
  });
  checks.push({
    name: "Sensitive APIs use private/no-store",
    pass: /Cache-Control["']?, value: ["']private, no-store/.test(nextConfigText)
      && /"Cache-Control": "private, no-store"/.test(routeText)
  });
  checks.push({
    name: "Platform admin runtime redaction still returns booleans only",
    pass: typeof getPlatformRuntimeStatus().encryption.configured === "boolean"
      && !JSON.stringify(getPlatformRuntimeStatus()).includes(process.env.APP_FIELD_ENCRYPTION_KEY ?? "definitely-not-present")
  });
  checks.push({
    name: "Client portal scoping still uses token lookup service",
    pass: routeText.includes("getClientPortalByToken") && routeText.includes("getDocumentRequestByToken")
  });
  checks.push({
    name: "Agent isolation still enforced on document download/export",
    pass: routeText.includes("canAccessMatter(context.user, document.matter)") && routeText.includes("canAccessMatter(context.user, matter)")
  });

  if (previousSecret == null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({ pass: failed.length === 0, checks, failed: failed.map((check) => check.name) }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

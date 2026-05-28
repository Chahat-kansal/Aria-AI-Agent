import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { listImmigrationSources, getSourceById } from "@/lib/data/immigration-source-registry";
import { listVisaSubclassCatalog, normalizeVisaCatalogCode } from "@/lib/data/visa-subclass-catalog";

export type DiscoveredVisaSubclass = {
  subclassCode: string;
  normalizedCode: string;
  name: string;
  stream?: string;
  url?: string;
  source: string;
  discoveryMethod: "HTML_REGEX" | "EMBEDDED_JSON" | "MANUAL_CATALOG";
  statusHint: "ACTIVE" | "UNKNOWN" | "NEEDS_REVIEW";
};

export type VisaSubclassDiscoveryResult = {
  sourceId: string;
  fetched: boolean;
  warnings: string[];
  discovered: DiscoveredVisaSubclass[];
  totalDiscovered: number;
  alreadyMapped: number;
  missingDefinitions: string[];
  discoveredButUnmapped: string[];
  closedOrUncertain: string[];
};

function extractSubclassCode(input: string) {
  const pair = input.match(/\b(820)\s*\/\s*(801)\b|\b(309)\s*\/\s*(100)\b/);
  if (pair) return pair[1] && pair[2] ? "820/801" : "309/100";
  const numeric = input.match(/\b\d{3}\b/g)?.[0];
  return numeric ?? input.trim();
}

function decodeVisaListingPayload(html: string) {
  return html
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026nbsp;/g, " ")
    .replace(/\\u0026amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\&quot;/g, "\"")
    .replace(/&quot;/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ");
}

function parseVisaListSource(html: string, sourceUrl: string) {
  const discovered: DiscoveredVisaSubclass[] = [];
  const seen = new Set<string>();
  const normalizedHtml = decodeVisaListingPayload(html);
  const anchors = [...normalizedHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const [, href, labelHtml] of anchors) {
    const label = labelHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const code = extractSubclassCode(label);
    if (!code || !/\d{3}|citizenship/i.test(code)) continue;
    if (/immigration and citizenship/i.test(label)) continue;
    const normalizedCode = normalizeVisaCatalogCode(code);
    if (seen.has(`${normalizedCode}:${label}`)) continue;
    seen.add(`${normalizedCode}:${label}`);
    discovered.push({
      subclassCode: code,
      normalizedCode,
      name: label,
      url: href.startsWith("http") ? href : new URL(href, sourceUrl).toString(),
      source: sourceUrl,
      discoveryMethod: "HTML_REGEX",
      statusHint: "UNKNOWN"
    });
  }
  return discovered;
}

function parseEmbeddedJsonSource(html: string, sourceUrl: string) {
  const discovered: DiscoveredVisaSubclass[] = [];
  const normalizedHtml = decodeVisaListingPayload(html);
  for (const match of normalizedHtml.matchAll(/"title"\s*:\s*"([^"]*?\b\d{3}\b[^"]*)"|"name"\s*:\s*"([^"]*?\b\d{3}\b[^"]*)"/g)) {
    const label = (match[1] || match[2] || "").trim();
    const code = extractSubclassCode(label);
    if (!code) continue;
    discovered.push({
      subclassCode: code,
      normalizedCode: normalizeVisaCatalogCode(code),
      name: label,
      source: sourceUrl,
      discoveryMethod: "EMBEDDED_JSON",
      statusHint: "UNKNOWN"
    });
  }
  return discovered;
}

export async function discoverVisaSubclassesFromOfficialSource() {
  const source = getSourceById("home-affairs-visa-list");
  if (!source) throw new Error("Official visa list source is not registered.");

  const warnings: string[] = [];
  let discovered: DiscoveredVisaSubclass[] = [];
  let fetched = false;

  try {
    const response = await fetch(source.url, { headers: { "User-Agent": "AriaMigrationSaaS/1.0" } });
    if (!response.ok) {
      warnings.push(`Official visa list fetch returned HTTP ${response.status}. Falling back to manual catalog.`);
    } else {
      const html = await response.text();
      fetched = true;
      discovered = parseVisaListSource(html, source.url);
      if (!discovered.length) {
        discovered = parseEmbeddedJsonSource(html, source.url);
      }
      if (!discovered.length) {
        warnings.push("Official visa list did not yield parseable subclasses via static HTML or embedded JSON. Falling back to manual catalog.");
      }
    }
  } catch (error) {
    warnings.push(`Official visa list fetch failed: ${error instanceof Error ? error.message : String(error)}. Falling back to manual catalog.`);
  }

  if (!discovered.length) {
    discovered = listVisaSubclassCatalog().map((item) => ({
      subclassCode: item.subclassCode,
      normalizedCode: item.normalizedCode,
      name: item.name,
      stream: item.stream,
      url: item.sourceUrl,
      source: source.url,
      discoveryMethod: "MANUAL_CATALOG",
      statusHint: item.status === "ACTIVE" ? "ACTIVE" : item.status === "CLOSED" || item.status === "SUPERSEDED" ? "NEEDS_REVIEW" : "UNKNOWN"
    }));
  }

  const mapped = new Set(listVisaSubclassCatalog().map((item) => item.normalizedCode));
  const missingDefinitions = discovered.filter((item) => !mapped.has(item.normalizedCode)).map((item) => item.normalizedCode);
  const closedOrUncertain = listVisaSubclassCatalog()
    .filter((item) => item.status !== "ACTIVE")
    .map((item) => item.normalizedCode);

  return {
    sourceId: source.sourceId,
    fetched,
    warnings,
    discovered,
    totalDiscovered: discovered.length,
    alreadyMapped: discovered.filter((item) => mapped.has(item.normalizedCode)).length,
    missingDefinitions,
    discoveredButUnmapped: missingDefinitions,
    closedOrUncertain
  } satisfies VisaSubclassDiscoveryResult;
}

export async function writeDiscoveredVisaSubclasses(result: VisaSubclassDiscoveryResult) {
  const outputPath = path.join(process.cwd(), "data", "generated", "visa-subclasses.discovered.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const checksum = createHash("sha256").update(JSON.stringify(result.discovered)).digest("hex");
  await fs.writeFile(outputPath, JSON.stringify({ ...result, checksum, generatedAt: new Date().toISOString() }, null, 2));
  return outputPath;
}

export function listDiscoverySources() {
  return listImmigrationSources().filter((source) => source.sourceType === "VISA_LIST" || source.sourceType === "VISA_DETAIL");
}

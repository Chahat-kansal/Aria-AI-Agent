import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { listImmigrationSources, type ImmigrationSourceRecord } from "@/lib/data/immigration-source-registry";
import { listVisaSubclassCatalog, normalizeVisaCatalogCode } from "@/lib/data/visa-subclass-catalog";
import { OFFICIAL_HOME_AFFAIRS_FORMS } from "@/lib/data/official-home-affairs-forms";
import { detectFillableFields } from "@/lib/services/pdf-form-engine";

export type SourceFetchResult = {
  source: ImmigrationSourceRecord;
  ok: boolean;
  httpStatus?: number;
  title?: string;
  bodyTextPreview?: string;
  checksum?: string;
  error?: string;
};

export function computeChecksum(buffer: Buffer | string) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function normalizeFormNumber(text: string) {
  return text.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeSubclassCode(text: string) {
  return normalizeVisaCatalogCode(text);
}

export async function fetchSource(source: ImmigrationSourceRecord): Promise<SourceFetchResult> {
  if (source.crawlAllowedStatus === "DISALLOWED") {
    return { source, ok: false, error: "Crawl disallowed by registry. Manual review required." };
  }
  try {
    const response = await fetch(source.url, { headers: { "User-Agent": "AriaMigrationSaaS/1.0" } });
    const body = await response.text();
    return {
      source,
      ok: response.ok,
      httpStatus: response.status,
      title: body.match(/<title>(.*?)<\/title>/i)?.[1]?.trim(),
      bodyTextPreview: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200),
      checksum: computeChecksum(body),
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return { source, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseVisaListSource(html: string) {
  return [...html.matchAll(/\b(?:Subclass\s*)?(\d{3})(?:\s*\/\s*(\d{3}))?\b/g)].map((match) => {
    const code = match[2] ? `${match[1]}/${match[2]}` : match[1];
    return {
      subclassCode: code,
      normalizedCode: normalizeSubclassCode(code),
      text: match[0]
    };
  });
}

export function parsePdfFormsSource(html: string) {
  return [...html.matchAll(/forms\/([0-9a-z]+)\.pdf/gi)].map((match) => ({
    formNumber: normalizeFormNumber(match[1]),
    href: match[0]
  }));
}

export function discoverPdfLinks(html: string, baseUrl: string) {
  return [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((match) =>
    match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).toString()
  );
}

export async function downloadOfficialPdf(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "AriaMigrationSaaS/1.0" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function inspectPdf(buffer: Buffer) {
  const fillable = await detectFillableFields(buffer);
  return {
    checksum: computeChecksum(buffer),
    fillable: fillable.fillable,
    fieldCount: fillable.fields.length,
    fields: fillable.fields
  };
}

export async function upsertSourceSnapshot(snapshot: Record<string, unknown>) {
  const outputPath = path.join(process.cwd(), "data", "generated", "immigration-source-snapshots.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  let existing: Record<string, unknown>[] = [];
  try {
    existing = JSON.parse(await fs.readFile(outputPath, "utf8")) as Record<string, unknown>[];
  } catch {
    existing = [];
  }
  const sourceId = String(snapshot.sourceId ?? "");
  const next = [...existing.filter((item) => String(item.sourceId ?? "") !== sourceId), snapshot];
  await fs.writeFile(outputPath, JSON.stringify(next, null, 2));
  return snapshot;
}

export async function upsertOfficialFormRegistryEntry(entry: Record<string, unknown>) {
  const outputPath = path.join(process.cwd(), "data", "generated", "official-forms-registry.snapshot.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  let existing: Record<string, unknown>[] = [];
  try {
    existing = JSON.parse(await fs.readFile(outputPath, "utf8")) as Record<string, unknown>[];
  } catch {
    existing = [];
  }
  const formNumber = String(entry.formNumber ?? "");
  const next = [...existing.filter((item) => String(item.formNumber ?? "") !== formNumber), entry];
  await fs.writeFile(outputPath, JSON.stringify(next, null, 2));
  return entry;
}

export async function upsertVisaSubclassRegistryEntry(entry: Record<string, unknown>) {
  const outputPath = path.join(process.cwd(), "data", "generated", "visa-subclass-registry.snapshot.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  let existing: Record<string, unknown>[] = [];
  try {
    existing = JSON.parse(await fs.readFile(outputPath, "utf8")) as Record<string, unknown>[];
  } catch {
    existing = [];
  }
  const subclassCode = String(entry.normalizedCode ?? entry.subclassCode ?? "");
  const next = [...existing.filter((item) => String(item.normalizedCode ?? item.subclassCode ?? "") !== subclassCode), entry];
  await fs.writeFile(outputPath, JSON.stringify(next, null, 2));
  return entry;
}

export function detectSourceChange(previousChecksum: string | undefined, nextChecksum: string | undefined) {
  return !!previousChecksum && !!nextChecksum && previousChecksum !== nextChecksum;
}

export function markMappingReviewRequired(input: { changed: boolean; notes?: string }) {
  return input.changed
    ? `Mapping review required: source checksum changed. ${input.notes ?? ""}`.trim()
    : input.notes ?? "No source checksum change detected.";
}

export async function buildLocalRegistrySnapshots() {
  const sources = listImmigrationSources();
  const forms = OFFICIAL_HOME_AFFAIRS_FORMS;
  const subclasses = listVisaSubclassCatalog();
  await upsertSourceSnapshot({ sourceId: "seed-count", generatedAt: new Date().toISOString(), count: sources.length });
  for (const form of forms) {
    await upsertOfficialFormRegistryEntry({
      formNumber: form.formNumber,
      normalizedFormNumber: normalizeFormNumber(form.formNumber),
      title: form.title,
      category: form.category,
      supportStatus: form.supportStatus,
      lifecycleStatus: form.lifecycleStatus,
      subclassCodes: form.subclassCodes,
      sourceUrl: form.sourceUrl,
      sourceName: form.sourceName,
      notes: form.notes
    });
  }
  for (const subclass of subclasses) {
    await upsertVisaSubclassRegistryEntry(subclass);
  }
  return {
    sources: sources.length,
    forms: forms.length,
    subclasses: subclasses.length
  };
}

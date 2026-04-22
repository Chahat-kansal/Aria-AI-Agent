import crypto from "crypto";
import { ImpactLevel, ImpactStatus, MatterStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOfficialUpdateConnector, type OfficialSourceConfig, type OfficialUpdateConnector, type OfficialUpdatePayload } from "@/lib/connectors/update-connector";

const DEFAULT_OFFICIAL_SOURCES: OfficialSourceConfig[] = [
  {
    name: "Department of Home Affairs - Immigration and citizenship news",
    sourceType: "HOME_AFFAIRS_NEWS",
    url: "https://immi.homeaffairs.gov.au/news-media/archive"
  }
];

const updateTypeRules: Array<{ type: string; patterns: RegExp[] }> = [
  { type: "legislative/regulatory", patterns: [/legislation/i, /regulation/i, /instrument/i, /migration act/i] },
  { type: "policy/process guidance", patterns: [/policy/i, /guidance/i, /procedure/i, /process/i] },
  { type: "visa/subclass-specific update", patterns: [/subclass/i, /\bvisa\b/i, /\b500\b/i, /\b482\b/i, /\b189\b/i, /\b190\b/i, /\b820\b/i] },
  { type: "fee-related", patterns: [/fee/i, /charge/i, /levy/i, /price/i] },
  { type: "processing-related", patterns: [/processing/i, /priority/i, /backlog/i, /timeframe/i] },
  { type: "document/evidence-related", patterns: [/document/i, /evidence/i, /proof/i, /checklist/i] }
];

export function hashUpdateContent(rawContent: string) {
  return crypto.createHash("sha256").update(rawContent).digest("hex");
}

export function classifyUpdate(update: OfficialUpdatePayload) {
  const haystack = `${update.title} ${update.summary} ${update.rawContent}`;
  return updateTypeRules.find((rule) => rule.patterns.some((pattern) => pattern.test(haystack)))?.type ?? "operational/general notice";
}

function parseDate(value: string | undefined, fallback = new Date()) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function subclassMatches(update: OfficialUpdatePayload, subclass: string) {
  const haystack = `${update.title} ${update.summary} ${update.rawContent}`.toLowerCase();
  return haystack.includes(`subclass ${subclass}`) || haystack.includes(`subclass${subclass}`) || haystack.includes(` ${subclass} `);
}

function streamMatches(update: OfficialUpdatePayload, stream: string) {
  if (!stream || stream.length < 4) return false;
  return `${update.title} ${update.summary} ${update.rawContent}`.toLowerCase().includes(stream.toLowerCase());
}

function stageBoost(stage: MatterStage) {
  if (stage === "SUBMISSION_PREP" || stage === "VALIDATION") return "HIGH";
  if (stage === "FIELD_REVIEW" || stage === "EVIDENCE") return "MEDIUM";
  return "LOW";
}

function determineImpact(update: OfficialUpdatePayload, matter: { visaSubclass: string; visaStream: string; stage: MatterStage; lodgementTargetDate: Date | null; readinessScore: number }) {
  const directSubclass = subclassMatches(update, matter.visaSubclass);
  const directStream = streamMatches(update, matter.visaStream);
  const visaWide = /\bvisa\b/i.test(`${update.title} ${update.summary}`);
  const evidenceRelated = /document|evidence|proof|checklist/i.test(`${update.title} ${update.summary}`);

  if (!directSubclass && !directStream && !visaWide && !evidenceRelated) return null;

  let impactLevel = stageBoost(matter.stage) as keyof typeof ImpactLevel;
  if (directSubclass || directStream) impactLevel = matter.stage === "INTAKE" ? "MEDIUM" : "HIGH";
  if (evidenceRelated && matter.readinessScore < 75) impactLevel = impactLevel === "LOW" ? "MEDIUM" : impactLevel;

  const reasons = [
    directSubclass ? `mentions Subclass ${matter.visaSubclass}` : null,
    directStream ? `mentions ${matter.visaStream}` : null,
    visaWide ? "contains visa-related language" : null,
    evidenceRelated ? "may affect evidence or document review" : null,
    `matter is in ${matter.stage.toLowerCase().replace(/_/g, " ")} stage`
  ].filter(Boolean);

  return {
    impactLevel,
    reason: reasons.join("; "),
    actionRequired: "Review the source update against this matter before relying on current checklist, evidence, or submission-readiness assumptions."
  };
}

export async function ensureDefaultOfficialSources() {
  const sources = [];

  for (const source of DEFAULT_OFFICIAL_SOURCES) {
    sources.push(
      await prisma.officialSource.upsert({
        where: { url: source.url },
        update: { name: source.name, sourceType: source.sourceType, active: true },
        create: { name: source.name, sourceType: source.sourceType, url: source.url, active: true }
      })
    );
  }

  return sources;
}

export async function getActiveOfficialUpdateConnectors() {
  const configuredSources = await ensureDefaultOfficialSources();
  const activeSources = await prisma.officialSource.findMany({ where: { active: true } });
  const sources = activeSources.length ? activeSources : configuredSources;

  return sources
    .map((source) => createOfficialUpdateConnector({ id: source.id, name: source.name, sourceType: source.sourceType, url: source.url, metadata: source.metadataJson as Record<string, unknown> | undefined }))
    .filter((connector): connector is OfficialUpdateConnector => Boolean(connector));
}

export function dedupeByHash(updates: OfficialUpdatePayload[]) {
  const seen = new Set<string>();
  return updates.filter((update) => {
    const hash = hashUpdateContent(update.rawContent);
    const key = `${update.sourceUrl}:${hash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function persistOfficialUpdates(updates: OfficialUpdatePayload[]) {
  const persisted = [];

  for (const update of dedupeByHash(updates)) {
    const sourceId = typeof update.metadata?.sourceId === "string" ? update.metadata.sourceId : undefined;
    const source = sourceId ? await prisma.officialSource.findUnique({ where: { id: sourceId } }) : null;
    const rawContentHash = hashUpdateContent(update.rawContent);
    const stored = await prisma.officialUpdate.upsert({
      where: { sourceUrl_rawContentHash: { sourceUrl: update.sourceUrl, rawContentHash } },
      update: {
        title: update.title,
        summary: update.summary,
        updateType: update.updateType ?? classifyUpdate(update),
        effectiveDate: update.effectiveDate ? parseDate(update.effectiveDate) : null,
        publishedAt: parseDate(update.publishedAt),
        sourceMetadata: update.metadata ?? {},
        ingestedAt: new Date()
      },
      create: {
        officialSourceId: source?.id,
        source: update.sourceName,
        sourceUrl: update.sourceUrl,
        title: update.title,
        summary: update.summary,
        updateType: update.updateType ?? classifyUpdate(update),
        effectiveDate: update.effectiveDate ? parseDate(update.effectiveDate) : null,
        publishedAt: parseDate(update.publishedAt),
        rawContentHash,
        sourceMetadata: update.metadata ?? {}
      }
    });

    persisted.push({ stored, payload: update });
  }

  return persisted;
}

export async function matchUpdateToAffectedMatters(updateId: string, payload: OfficialUpdatePayload) {
  const update = await prisma.officialUpdate.findUnique({ where: { id: updateId } });
  if (!update) return [];

  const matters = await prisma.matter.findMany({
    select: { id: true, visaSubclass: true, visaStream: true, stage: true, lodgementTargetDate: true, readinessScore: true }
  });

  const impacts = [];
  for (const matter of matters) {
    const impact = determineImpact(payload, matter);
    if (!impact) continue;

    impacts.push(
      await prisma.matterImpact.upsert({
        where: { officialUpdateId_matterId: { officialUpdateId: update.id, matterId: matter.id } },
        update: {
          impactLevel: impact.impactLevel,
          reason: impact.reason,
          actionRequired: impact.actionRequired,
          status: ImpactStatus.NEW
        },
        create: {
          officialUpdateId: update.id,
          matterId: matter.id,
          impactLevel: impact.impactLevel,
          reason: impact.reason,
          actionRequired: impact.actionRequired,
          status: ImpactStatus.NEW
        }
      })
    );
  }

  return impacts;
}

export async function runOfficialUpdateIngestion() {
  const connectors = await getActiveOfficialUpdateConnectors();
  const fetched = (await Promise.all(connectors.map((connector) => connector.fetchUpdates()))).flat();
  const persisted = await persistOfficialUpdates(fetched);
  const impacts = [];

  for (const item of persisted) {
    impacts.push(...(await matchUpdateToAffectedMatters(item.stored.id, item.payload)));
  }

  await prisma.officialSource.updateMany({
    where: { id: { in: connectors.map((connector) => connector.source.id).filter((id): id is string => Boolean(id)) } },
    data: { lastFetchedAt: new Date() }
  });

  return {
    sources: connectors.length,
    fetched: fetched.length,
    stored: persisted.length,
    impactedMatters: impacts.length
  };
}

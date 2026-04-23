import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getWebResearchProvider } from "@/lib/services/web-research";

type VisaKnowledgePayload = {
  subclassCode?: string;
  stream?: string;
  title: string;
  summary: string;
  keyRequirements: string[];
  evidence: string[];
  sourceUrl: string;
  sourceType: string;
  rawContent: string;
};

const VISA_LIST_URL = "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing";

function hashContent(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function subclassFromTitle(value: string) {
  return value.match(/\bSubclass\s+(\d{3,4})\b/i)?.[1] ?? value.match(/\b(\d{3,4})\b/)?.[1];
}

function inferEvidence(title: string, summary: string) {
  const haystack = `${title} ${summary}`.toLowerCase();
  const evidence = ["Identity and passport evidence", "Current visa and immigration history"];
  if (/student|study|training|graduate/.test(haystack)) evidence.push("Education enrolment, completion, and English evidence");
  if (/work|skilled|employer|sponsor|nomination/.test(haystack)) evidence.push("Occupation, skills, employment, and sponsor evidence");
  if (/partner|family|parent|child|carer/.test(haystack)) evidence.push("Relationship, sponsor, family composition, and dependency evidence");
  if (/business|investor|innovation/.test(haystack)) evidence.push("Business, investment, source-of-funds, and ownership evidence");
  if (/visitor|tourist/.test(haystack)) evidence.push("Genuine temporary stay, funds, itinerary, and ties evidence");
  return Array.from(new Set(evidence));
}

function inferRequirements(title: string, summary: string) {
  const requirements = ["Confirm eligibility against the current official source page", "Confirm identity, character, health, and visa history requirements"];
  const haystack = `${title} ${summary}`.toLowerCase();
  if (/sponsor|nomination/.test(haystack)) requirements.push("Sponsorship or nomination must be reviewed");
  if (/points|skilled/.test(haystack)) requirements.push("Skills assessment, points, English, and occupation settings must be reviewed");
  if (/student|study/.test(haystack)) requirements.push("Course enrolment, genuine student factors, funds, and OSHC must be reviewed");
  if (/citizenship/.test(haystack)) requirements.push("Residence, identity, character, and absences must be reviewed");
  return Array.from(new Set(requirements));
}

async function fetchOfficialVisaListing() {
  const response = await fetch(VISA_LIST_URL, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "user-agent": "AriaMigrationAgents/1.0 visa-knowledge-ingestion"
    }
  });
  if (!response.ok) throw new Error(`Unable to fetch visa listing: ${response.status}`);
  const html = await response.text();
  const links = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const seen = new Set<string>();
  const records: VisaKnowledgePayload[] = [];

  for (const [, href, labelHtml] of links) {
    const title = stripTags(labelHtml);
    const sourceUrl = toAbsoluteUrl(href, VISA_LIST_URL);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    if (!sourceUrl.includes("/visas/getting-a-visa/visa-listing/")) continue;
    if (title.length < 8) continue;

    seen.add(sourceUrl);
    const subclassCode = subclassFromTitle(title);
    const summary = title.includes("Subclass") ? title : `${title}. Official Home Affairs visa pathway page.`;
    records.push({
      subclassCode,
      title,
      summary,
      keyRequirements: inferRequirements(title, summary),
      evidence: inferEvidence(title, summary),
      sourceUrl,
      sourceType: "official-home-affairs",
      rawContent: `${title}\n${summary}\n${sourceUrl}`
    });
  }

  return records;
}

async function fetchProviderVisaKnowledge() {
  const provider = getWebResearchProvider();
  const response = await provider.search({
    query: "site:immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing Australian visa subclass official",
    officialOnly: true,
    maxResults: 10
  });

  return response.results.map((result): VisaKnowledgePayload => ({
    subclassCode: subclassFromTitle(result.title),
    title: result.title,
    summary: result.content || result.title,
    keyRequirements: inferRequirements(result.title, result.content),
    evidence: inferEvidence(result.title, result.content),
    sourceUrl: result.url,
    sourceType: result.sourceType === "official" ? "official-web-research" : "public-web-research",
    rawContent: `${result.title}\n${result.content}\n${result.url}`
  }));
}

export async function ingestVisaKnowledge() {
  const directRecords = await fetchOfficialVisaListing().catch(() => []);
  const providerRecords = await fetchProviderVisaKnowledge().catch(() => []);
  const records = [...directRecords, ...providerRecords];
  const persisted = [];
  const seen = new Set<string>();

  for (const record of records) {
    const contentHash = hashContent(record.rawContent);
    const key = `${record.sourceUrl}:${contentHash}`;
    if (seen.has(key)) continue;
    seen.add(key);

    persisted.push(
      await prisma.visaKnowledgeRecord.upsert({
        where: { sourceUrl_contentHash: { sourceUrl: record.sourceUrl, contentHash } },
        update: {
          title: record.title,
          summary: record.summary,
          subclassCode: record.subclassCode,
          stream: record.stream,
          keyRequirementsJson: record.keyRequirements,
          evidenceJson: record.evidence,
          sourceType: record.sourceType,
          lastRefreshedAt: new Date()
        },
        create: {
          title: record.title,
          summary: record.summary,
          subclassCode: record.subclassCode,
          stream: record.stream,
          keyRequirementsJson: record.keyRequirements,
          evidenceJson: record.evidence,
          sourceUrl: record.sourceUrl,
          sourceType: record.sourceType,
          contentHash
        }
      })
    );
  }

  return { fetched: records.length, stored: persisted.length };
}

export async function getVisaKnowledgeRecords(query?: string) {
  const trimmed = query?.trim();
  return prisma.visaKnowledgeRecord.findMany({
    where: trimmed
      ? {
          OR: [
            { subclassCode: { contains: trimmed, mode: "insensitive" } },
            { stream: { contains: trimmed, mode: "insensitive" } },
            { title: { contains: trimmed, mode: "insensitive" } },
            { summary: { contains: trimmed, mode: "insensitive" } },
            { sourceType: { contains: trimmed, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: [{ subclassCode: "asc" }, { title: "asc" }]
  });
}

export async function getVisaKnowledgeRecord(recordId: string) {
  return prisma.visaKnowledgeRecord.findUnique({ where: { id: recordId } });
}

export async function getVisaSubclassOptions() {
  const records = await prisma.visaKnowledgeRecord.findMany({
    where: { subclassCode: { not: null } },
    select: { subclassCode: true, title: true, stream: true, sourceUrl: true, lastRefreshedAt: true },
    orderBy: [{ subclassCode: "asc" }, { title: "asc" }]
  });

  const bySubclass = new Map<string, typeof records[number]>();
  for (const record of records) {
    if (record.subclassCode && !bySubclass.has(record.subclassCode)) bySubclass.set(record.subclassCode, record);
  }

  return Array.from(bySubclass.values());
}

export async function getVisaKnowledgeForAssistant(query: string) {
  const subclass = query.match(/\b(?:subclass\s*)?(\d{3,4})\b/i)?.[1];
  return prisma.visaKnowledgeRecord.findMany({
    where: subclass
      ? { subclassCode: subclass }
      : { OR: [{ title: { contains: "citizenship", mode: "insensitive" } }, { summary: { contains: "permanent", mode: "insensitive" } }] },
    orderBy: { lastRefreshedAt: "desc" },
    take: 5
  });
}

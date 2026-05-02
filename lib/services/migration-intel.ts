import crypto from "crypto";
import {
  ImpactLevel,
  ImpactStatus,
  MigrationIntelSeverity,
  MigrationIntelSourceType,
  MigrationIntelSweepStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { isAiConfigured } from "@/lib/services/ai-config";
import { fetchMigrationNewsIntel } from "@/lib/services/migration-news-intel";
import { serverLog } from "@/lib/services/runtime-config";

type ClassifiedIntel = {
  isRelevant: boolean;
  sourceType: "OFFICIAL" | "NEWS" | "FIRM_NOTE";
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  affectedSubclasses: string[];
  tags: string[];
  riskReason: string;
  recommendedAgentActions: string[];
  reviewRequired: true;
};

type RawIntelItem = {
  title: string;
  summary?: string;
  sourceUrl: string;
  sourceName: string;
  sourceSiteUrl?: string | null;
  sourceType: MigrationIntelSourceType;
  publishedAt?: string | null;
  rawContent: string;
  feedUrl?: string;
  fetchedAt?: string;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isOfficialSource(rawItem: RawIntelItem) {
  const checks = [rawItem.sourceUrl, rawItem.sourceSiteUrl ?? "", rawItem.sourceName].join(" ").toLowerCase();
  return [
    "homeaffairs.gov.au",
    "immi.homeaffairs.gov.au",
    "legislation.gov.au",
    "mara.gov.au",
    "department of home affairs"
  ].some((needle) => checks.includes(needle));
}

function buildInternalSourceUrl(workspaceId: string, title: string, summary: string) {
  return `aria://workspace-note/${workspaceId}/${sha256(`${title}:${summary}`).slice(0, 16)}`;
}

function extractSubclasses(text: string) {
  const matches = new Set<string>();
  for (const match of text.matchAll(/\b(?:subclass\s*)?(\d{3})(?:\/(\d{3}))?\b/gi)) {
    if (match[1]) matches.add(match[1]);
    if (match[2]) matches.add(match[2]);
  }
  return Array.from(matches).slice(0, 12);
}

function extractTags(text: string) {
  const tags = new Set<string>();
  const rules: Array<[string, RegExp]> = [
    ["policy", /\bpolicy|guidance|procedure|minister\b/i],
    ["legislation", /\blegislation|instrument|regulation|bill\b/i],
    ["fees", /\bfee|charge|levy|pricing\b/i],
    ["processing", /\bprocessing|backlog|timeframe|priority\b/i],
    ["compliance", /\bcompliance|enforcement|cancellation|deport|section 48\b/i],
    ["student", /\bstudent|subclass 500|500\b/i],
    ["skilled", /\b189|190|491|482|186|skilled\b/i],
    ["partner", /\bpartner|820|801\b/i],
    ["forms", /\bform|application form\b/i],
    ["evidence", /\bevidence|document|checklist|proof\b/i]
  ];
  for (const [tag, pattern] of rules) {
    if (pattern.test(text)) tags.add(tag);
  }
  return Array.from(tags).slice(0, 12);
}

function deterministicClassification(rawItem: RawIntelItem): ClassifiedIntel {
  const haystack = `${rawItem.title} ${rawItem.summary ?? ""} ${rawItem.rawContent}`.trim();
  const lower = haystack.toLowerCase();
  const limitedSourceContext = rawItem.rawContent.trim().length < 180;
  const relevant =
    /\bvisa|migration|immigration|home affairs|subclass|student visa|partner visa|skilled visa|sponsor|nomination|citizenship\b/i.test(haystack);
  const severity: ClassifiedIntel["severity"] =
    /\b(cancelled visas?|deported|compliance action|legislation change|ministerial direction)\b/i.test(haystack)
      ? "CRITICAL"
      : /\b(urgent|deadline|major change|suspension|fee increase|health|character|restriction)\b/i.test(haystack)
        ? "HIGH"
        : /\b(update|guidance|processing|form|document|evidence)\b/i.test(haystack)
          ? "MEDIUM"
          : /\b(news|report|commentary)\b/i.test(haystack)
            ? "LOW"
            : "INFO";

  return {
    isRelevant: relevant,
    sourceType: isOfficialSource(rawItem) ? "OFFICIAL" : rawItem.sourceType === MigrationIntelSourceType.FIRM_NOTE ? "FIRM_NOTE" : "NEWS",
    severity,
    summary:
      rawItem.summary?.trim() ||
      rawItem.rawContent.trim().slice(0, 320) ||
      "Limited source context was available for this migration intelligence item.",
    affectedSubclasses: extractSubclasses(haystack),
    tags: extractTags(haystack),
    riskReason: limitedSourceContext
      ? "Classification used limited source context and requires review."
      : severity === "CRITICAL"
        ? "The source mentions a high-risk migration policy, compliance, or enforcement signal."
        : "The source appears relevant to migration operations and should be reviewed by an agent.",
    recommendedAgentActions: [
      isOfficialSource(rawItem)
        ? "Open the original source and confirm the exact policy language."
        : "Confirm this report against an official government or legislative source before changing advice.",
      extractSubclasses(haystack).length
        ? `Review active matters touching subclasses ${extractSubclasses(haystack).join(", ")}.`
        : "Review whether any active matters rely on the changed policy area.",
      "Record human review before changing client-facing advice."
    ],
    reviewRequired: true
  };
}

async function aiClassification(rawItem: RawIntelItem): Promise<ClassifiedIntel> {
  const classification = await generateAriaAiResponse({
    system: `
You classify Australian migration intelligence items.

Rules:
- Use only the supplied title, summary, raw content, source name, source URL, and source site URL.
- OFFICIAL is only for official government or Home Affairs sources.
- NEWS is useful intelligence but is not law or policy by itself.
- Do not invent source content.
- If the source snippet is weak, say "limited source context".
- Return strict JSON only with:
{
  "isRelevant": boolean,
  "sourceType": "OFFICIAL" | "NEWS" | "FIRM_NOTE",
  "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": string,
  "affectedSubclasses": string[],
  "tags": string[],
  "riskReason": string,
  "recommendedAgentActions": string[],
  "reviewRequired": true
}
`.trim(),
    user: "Classify this migration intelligence item.",
    context: rawItem
  });

  const fallback = deterministicClassification(rawItem);
  return {
    isRelevant: typeof classification?.isRelevant === "boolean" ? classification.isRelevant : fallback.isRelevant,
    sourceType: ["OFFICIAL", "NEWS", "FIRM_NOTE"].includes(String(classification?.sourceType))
      ? classification.sourceType
      : fallback.sourceType,
    severity: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(classification?.severity))
      ? classification.severity
      : fallback.severity,
    summary: typeof classification?.summary === "string" && classification.summary.trim() ? classification.summary.trim() : fallback.summary,
    affectedSubclasses: Array.isArray(classification?.affectedSubclasses)
      ? classification.affectedSubclasses.map(String).slice(0, 12)
      : fallback.affectedSubclasses,
    tags: Array.isArray(classification?.tags) ? classification.tags.map(String).slice(0, 12) : fallback.tags,
    riskReason: typeof classification?.riskReason === "string" && classification.riskReason.trim()
      ? classification.riskReason.trim()
      : fallback.riskReason,
    recommendedAgentActions: Array.isArray(classification?.recommendedAgentActions)
      ? classification.recommendedAgentActions.map(String).slice(0, 8)
      : fallback.recommendedAgentActions,
    reviewRequired: true
  };
}

export async function classifyMigrationIntel(rawItem: RawIntelItem): Promise<ClassifiedIntel> {
  if (!isAiConfigured()) {
    return deterministicClassification(rawItem);
  }

  try {
    return await aiClassification(rawItem);
  } catch (error) {
    serverLog("migration_intel.classification_failed", {
      sourceUrl: rawItem.sourceUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    return deterministicClassification(rawItem);
  }
}

async function ensureOfficialSource(rawItem: RawIntelItem) {
  const baseCandidate = rawItem.sourceSiteUrl || rawItem.sourceUrl;
  if (!/^https?:\/\//i.test(baseCandidate)) return null;

  const baseUrl = new URL(baseCandidate).origin;
  return prisma.officialSource.upsert({
    where: { url: baseUrl },
    update: {
      name: rawItem.sourceName,
      active: true,
      sourceType: rawItem.sourceType
    },
    create: {
      name: rawItem.sourceName,
      url: baseUrl,
      active: true,
      sourceType: rawItem.sourceType
    }
  });
}

async function upsertIntelItem(input: {
  rawItem: RawIntelItem;
  classification: ClassifiedIntel;
  workspaceId?: string | null;
}) {
  const source = await ensureOfficialSource(input.rawItem);
  const rawContentHash = sha256(input.rawItem.rawContent);
  const finalSourceType =
    input.classification.sourceType === "OFFICIAL"
      ? MigrationIntelSourceType.OFFICIAL
      : input.classification.sourceType === "FIRM_NOTE"
        ? MigrationIntelSourceType.FIRM_NOTE
        : MigrationIntelSourceType.NEWS;

  return prisma.officialUpdate.upsert({
    where: {
      sourceUrl_rawContentHash: {
        sourceUrl: input.rawItem.sourceUrl,
        rawContentHash
      }
    },
    update: {
      workspaceId: input.workspaceId ?? null,
      officialSourceId: source?.id ?? null,
      source: input.rawItem.sourceName,
      sourceType: finalSourceType,
      title: input.rawItem.title,
      summary: input.classification.summary,
      updateType: input.classification.tags[0] ?? "migration-intel",
      severity: input.classification.severity as MigrationIntelSeverity,
      publishedAt: input.rawItem.publishedAt ? new Date(input.rawItem.publishedAt) : new Date(),
      fetchedAt: input.rawItem.fetchedAt ? new Date(input.rawItem.fetchedAt) : new Date(),
      sourceMetadata: {
        rawSummary: input.rawItem.summary ?? null,
        limitedSourceContext: input.rawItem.rawContent.trim().length < 180,
        sourceSiteUrl: input.rawItem.sourceSiteUrl ?? null,
        feedUrl: input.rawItem.feedUrl ?? null,
        provider: "google-news-rss"
      } as any,
      affectedSubclassesJson: input.classification.affectedSubclasses as any,
      tagsJson: input.classification.tags as any,
      aiClassificationJson: input.classification as any,
      ingestedAt: new Date(),
      isArchived: false
    },
    create: {
      workspaceId: input.workspaceId ?? null,
      officialSourceId: source?.id ?? null,
      source: input.rawItem.sourceName,
      sourceType: finalSourceType,
      sourceUrl: input.rawItem.sourceUrl,
      title: input.rawItem.title,
      summary: input.classification.summary,
      updateType: input.classification.tags[0] ?? "migration-intel",
      severity: input.classification.severity as MigrationIntelSeverity,
      effectiveDate: null,
      publishedAt: input.rawItem.publishedAt ? new Date(input.rawItem.publishedAt) : new Date(),
      fetchedAt: input.rawItem.fetchedAt ? new Date(input.rawItem.fetchedAt) : new Date(),
      rawContentHash,
      sourceMetadata: {
        rawSummary: input.rawItem.summary ?? null,
        limitedSourceContext: input.rawItem.rawContent.trim().length < 180,
        sourceSiteUrl: input.rawItem.sourceSiteUrl ?? null,
        feedUrl: input.rawItem.feedUrl ?? null,
        provider: "google-news-rss"
      } as any,
      affectedSubclassesJson: input.classification.affectedSubclasses as any,
      tagsJson: input.classification.tags as any,
      aiClassificationJson: input.classification as any,
      isArchived: false
    }
  });
}

export async function findAffectedMatters(workspaceId: string, intelItemId: string) {
  const intelItem = await prisma.officialUpdate.findUnique({ where: { id: intelItemId } });
  if (!intelItem) return [];

  const affectedSubclasses = Array.isArray(intelItem.affectedSubclassesJson)
    ? intelItem.affectedSubclassesJson.map(String)
    : extractSubclasses(`${intelItem.title} ${intelItem.summary}`);
  const haystack = `${intelItem.title} ${intelItem.summary} ${JSON.stringify(intelItem.tagsJson ?? [])}`.toLowerCase();

  const matters = await prisma.matter.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      client: { archivedAt: null }
    },
    include: {
      client: true,
      pathwayAnalyses: { include: { options: { take: 2 } }, take: 2 }
    }
  });

  const impacts = [];
  for (const matter of matters) {
    const pathwayText = matter.pathwayAnalyses
      .flatMap((analysis) => analysis.options.map((option) => option.title))
      .join(" ")
      .toLowerCase();
    const currentVisaText = `${matter.currentVisaStatus ?? ""} ${matter.client.currentVisaStatus ?? ""}`.toLowerCase();
    const subclassMatch = affectedSubclasses.includes(matter.visaSubclass);
    const statusMatch = currentVisaText.includes(matter.visaSubclass.toLowerCase());
    const pathwayMatch = affectedSubclasses.some((code) => pathwayText.includes(code.toLowerCase()));
    const thematicMatch =
      haystack.includes(matter.visaSubclass.toLowerCase()) ||
      (matter.visaStream && haystack.includes(matter.visaStream.toLowerCase())) ||
      (haystack.includes("student") && matter.visaSubclass === "500") ||
      (haystack.includes("partner") && ["820", "801"].includes(matter.visaSubclass)) ||
      (haystack.includes("skilled") && ["189", "190", "491", "482", "186"].includes(matter.visaSubclass));

    if (!subclassMatch && !statusMatch && !pathwayMatch && !thematicMatch) continue;

    const impactLevel =
      intelItem.severity === "CRITICAL" || intelItem.severity === "HIGH"
        ? ImpactLevel.HIGH
        : intelItem.severity === "MEDIUM"
          ? ImpactLevel.MEDIUM
          : ImpactLevel.LOW;

    const impact = await prisma.matterImpact.upsert({
      where: { officialUpdateId_matterId: { officialUpdateId: intelItem.id, matterId: matter.id } },
      update: {
        clientId: matter.clientId,
        impactLevel,
        reason: subclassMatch
          ? `Matched Subclass ${matter.visaSubclass} against the classified affected subclasses.`
          : thematicMatch
            ? "Matched the update theme against the matter visa pathway and status."
            : "Matched current matter or client visa context against the migration intelligence item.",
        actionRequired: "Review the source-linked migration intelligence item against this matter before changing advice, evidence requests, or submission readiness.",
        status: ImpactStatus.NEW
      },
      create: {
        officialUpdateId: intelItem.id,
        matterId: matter.id,
        clientId: matter.clientId,
        impactLevel,
        reason: subclassMatch
          ? `Matched Subclass ${matter.visaSubclass} against the classified affected subclasses.`
          : thematicMatch
            ? "Matched the update theme against the matter visa pathway and status."
            : "Matched current matter or client visa context against the migration intelligence item.",
        actionRequired: "Review the source-linked migration intelligence item against this matter before changing advice, evidence requests, or submission readiness.",
        status: ImpactStatus.NEW
      }
    });
    impacts.push(impact);
  }

  return impacts;
}

export async function generateUpdateSummary(intelItemId: string) {
  const intelItem = await prisma.officialUpdate.findUnique({ where: { id: intelItemId } });
  if (!intelItem) return null;

  const classification = (intelItem.aiClassificationJson ?? {}) as Record<string, unknown>;
  const summary =
    typeof classification.summary === "string" && classification.summary.trim()
      ? classification.summary.trim()
      : intelItem.summary;

  return {
    id: intelItem.id,
    title: intelItem.title,
    summary,
    severity: intelItem.severity,
    affectedSubclasses: Array.isArray(intelItem.affectedSubclassesJson) ? intelItem.affectedSubclassesJson.map(String) : [],
    tags: Array.isArray(intelItem.tagsJson) ? intelItem.tagsJson.map(String) : [],
    reviewRequired: true
  };
}

export async function markUpdateReviewed(intelItemId: string, userId: string, workspaceId?: string) {
  const updated = await prisma.officialUpdate.update({
    where: { id: intelItemId },
    data: {
      reviewedByUserId: userId,
      reviewedAt: new Date()
    }
  });

  if (workspaceId) {
    await prisma.matterImpact.updateMany({
      where: {
        officialUpdateId: intelItemId,
        matter: { workspaceId }
      },
      data: {
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        status: ImpactStatus.REVIEWING
      }
    });
  }

  return updated;
}

export async function logManualMigrationIntel(input: {
  workspaceId: string;
  title: string;
  summary: string;
  severity: MigrationIntelSeverity;
  sourceName: string;
  sourceUrl?: string | null;
  affectedSubclasses?: string[];
  tags?: string[];
}) {
  const rawItem: RawIntelItem = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    sourceUrl: input.sourceUrl?.trim() || buildInternalSourceUrl(input.workspaceId, input.title, input.summary),
    sourceName: input.sourceName.trim() || "Workspace note",
    sourceType: MigrationIntelSourceType.FIRM_NOTE,
    publishedAt: new Date().toISOString(),
    rawContent: input.summary.trim(),
    fetchedAt: new Date().toISOString()
  };

  const classification: ClassifiedIntel = {
    isRelevant: true,
    sourceType: "FIRM_NOTE",
    severity: input.severity,
    summary: input.summary.trim(),
    affectedSubclasses: (input.affectedSubclasses ?? []).map(String).slice(0, 12),
    tags: (input.tags ?? []).map(String).slice(0, 12),
    riskReason: "Manually logged workspace note. Human review is required before operational changes.",
    recommendedAgentActions: ["Review the note, link any affected matters, and confirm whether a source citation should be added."],
    reviewRequired: true
  };

  return upsertIntelItem({
    rawItem,
    classification,
    workspaceId: input.workspaceId
  });
}

export async function sweepMigrationIntel(workspaceId?: string | null) {
  const aiConfigured = isAiConfigured();
  const sweepInput = await fetchMigrationNewsIntel();

  if (!sweepInput.items.length && sweepInput.errors.length) {
    throw new Error(sweepInput.errors[0] || "Unable to fetch Google News RSS migration intelligence.");
  }

  const sweep = await prisma.migrationIntelSweep.create({
    data: {
      workspaceId: workspaceId ?? null,
      status: MigrationIntelSweepStatus.STARTED,
      provider: sweepInput.provider,
      queryJson: [
        "Australia visa OR immigration policy",
        "Department of Home Affairs visa",
        "Australian migration update 482 OR 485 OR 189",
        "Australian student visa update subclass 500",
        "Australian skilled visa update 189 190 491",
        "Australian employer sponsored visa update 482 186",
        "Australian partner visa update 820 801"
      ] as any,
      feedUrlsJson: sweepInput.feedUrls as any
    }
  });

  try {
    const rawItems: RawIntelItem[] = sweepInput.items.map((item) => ({
      title: item.title,
      summary: item.summary,
      sourceUrl: item.articleUrl,
      sourceName: item.sourceName,
      sourceSiteUrl: item.sourceSiteUrl ?? null,
      sourceType: isOfficialSource({
        title: item.title,
        summary: item.summary,
        sourceUrl: item.articleUrl,
        sourceName: item.sourceName,
        sourceSiteUrl: item.sourceSiteUrl ?? null,
        sourceType: MigrationIntelSourceType.NEWS,
        rawContent: `${item.title} ${item.summary}`
      } as RawIntelItem)
        ? MigrationIntelSourceType.OFFICIAL
        : MigrationIntelSourceType.NEWS,
      publishedAt: item.publishedAt ?? null,
      rawContent: `${item.title}\n${item.summary}`,
      feedUrl: item.feedUrl,
      fetchedAt: item.fetchedAt
    }));

    const uniqueItems = rawItems.filter((item, index, array) => {
      const key = `${item.sourceUrl}:${sha256(item.rawContent)}`;
      return array.findIndex((candidate) => `${candidate.sourceUrl}:${sha256(candidate.rawContent)}` === key) === index;
    });

    let added = 0;
    let skipped = 0;
    const persisted = [];
    for (const rawItem of uniqueItems) {
      const classification = await classifyMigrationIntel(rawItem);
      if (!classification.isRelevant) {
        skipped += 1;
        continue;
      }

      const existing = await prisma.officialUpdate.findUnique({
        where: {
          sourceUrl_rawContentHash: {
            sourceUrl: rawItem.sourceUrl,
            rawContentHash: sha256(rawItem.rawContent)
          }
        },
        select: { id: true }
      });

      const stored = await upsertIntelItem({ rawItem, classification, workspaceId: null });
      persisted.push(stored);
      if (existing) skipped += 1;
      else added += 1;
    }

    const impacted = [];
    if (workspaceId) {
      for (const item of persisted) {
        impacted.push(...(await findAffectedMatters(workspaceId, item.id)));
      }
    } else {
      const workspaces = await prisma.workspace.findMany({ select: { id: true } });
      for (const workspace of workspaces) {
        for (const item of persisted) {
          impacted.push(...(await findAffectedMatters(workspace.id, item.id)));
        }
      }
    }

    const warningParts = [
      !aiConfigured ? "AI classification is not configured." : null,
      sweepInput.errors.length ? `Some feeds failed: ${sweepInput.errors.join(" | ")}` : null
    ].filter(Boolean);

    await prisma.migrationIntelSweep.update({
      where: { id: sweep.id },
      data: {
        status: MigrationIntelSweepStatus.COMPLETED,
        resultCount: uniqueItems.length,
        addedCount: added,
        skippedCount: skipped,
        completedAt: new Date()
      }
    });

    return {
      sweepId: sweep.id,
      provider: sweepInput.provider,
      fetched: uniqueItems.length,
      added,
      skipped,
      stored: persisted.length,
      impactedMatters: impacted.length,
      aiConfigured,
      warning: warningParts.length ? warningParts.join(" ") : null,
      message: added
        ? `Fetched ${uniqueItems.length} real migration update candidate(s) and stored ${added} new item(s).`
        : `Fetched ${uniqueItems.length} real migration update candidate(s). No new items were added.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.migrationIntelSweep.update({
      where: { id: sweep.id },
      data: {
        status: MigrationIntelSweepStatus.FAILED,
        errorMessage: message,
        completedAt: new Date()
      }
    });
    throw error;
  }
}

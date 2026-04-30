import { prisma } from "@/lib/prisma";
import { isEmbeddingsConfigured, upsertEmbeddingRecord } from "@/lib/services/embeddings";
import { serverLog } from "@/lib/services/runtime-config";

type RetrievalResult = {
  label: string;
  href: string;
  content: string;
  entityType: string;
  entityId: string;
};

function tokenize(query: string) {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 2);
}

function keywordScore(content: string, tokens: string[]) {
  const lower = content.toLowerCase();
  return tokens.reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0);
}

export async function retrieveRelevantContext(input: {
  workspaceId?: string;
  query: string;
  limit?: number;
}) {
  const limit = input.limit ?? 6;
  const tokens = tokenize(input.query);

  const embeddings = await prisma.knowledgeEmbedding.findMany({
    where: {
      OR: [
        { workspaceId: input.workspaceId ?? null },
        { workspaceId: null }
      ]
    },
    orderBy: { updatedAt: "desc" },
    take: 120
  });

  const ranked = embeddings
    .map((item: any) => ({
      item,
      score: keywordScore(item.content, tokens)
    }))
    .filter((row: any) => row.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit)
    .map<RetrievalResult>((row: any) => ({
      label: `${row.item.entityType}: ${row.item.entityId}`,
      href: row.item.sourceUrl || "#",
      content: row.item.content,
      entityType: row.item.entityType,
      entityId: row.item.entityId
    }));

  return {
    configured: isEmbeddingsConfigured(),
    mode: isEmbeddingsConfigured() ? "embedding-ready-keyword-ranked" : "keyword-fallback",
    results: ranked
  };
}

export async function refreshRetrievalIndexForWorkspace(workspaceId: string) {
  try {
    const [knowledge, updates, documents] = await Promise.all([
      prisma.visaKnowledgeRecord.findMany({
        where: { OR: [{ workspaceId }, { workspaceId: null }] },
        take: 60,
        orderBy: { updatedAt: "desc" }
      }),
      prisma.officialUpdate.findMany({
        take: 40,
        orderBy: { publishedAt: "desc" }
      }),
      prisma.document.findMany({
        where: { workspaceId },
        include: { extractionResults: { orderBy: { createdAt: "desc" }, take: 1 } },
        take: 80,
        orderBy: { createdAt: "desc" }
      })
    ]);

    for (const record of knowledge) {
      await upsertEmbeddingRecord({
        workspaceId: record.workspaceId,
        entityType: "VisaKnowledgeRecord",
        entityId: record.id,
        content: `${record.title}\n${record.summary}\n${JSON.stringify(record.keyRequirementsJson)}\n${JSON.stringify(record.evidenceJson)}`,
        sourceUrl: record.sourceUrl
      });
    }

    for (const update of updates) {
      await upsertEmbeddingRecord({
        workspaceId: null,
        entityType: "OfficialUpdate",
        entityId: update.id,
        content: `${update.title}\n${update.summary}\n${update.updateType}`,
        sourceUrl: update.sourceUrl
      });
    }

    for (const document of documents) {
      const extraction = (document.extractionResults[0]?.extractedJson ?? {}) as Record<string, any>;
      const preview = typeof extraction.extractedTextPreview === "string" ? extraction.extractedTextPreview : "";
      await upsertEmbeddingRecord({
        workspaceId,
        entityType: "Document",
        entityId: document.id,
        content: `${document.fileName}\n${document.category}\n${preview}`.trim()
      });
    }
  } catch (error) {
    serverLog("retrieval.refresh_error", { workspaceId, error: error instanceof Error ? error.message : String(error) });
  }
}

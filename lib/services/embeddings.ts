import { prisma } from "@/lib/prisma";
import { getEmbeddingsConfigStatus, serverLog } from "@/lib/services/runtime-config";

export function isEmbeddingsConfigured() {
  return getEmbeddingsConfigStatus().configured;
}

export async function createEmbedding(input: { content: string }) {
  const status = getEmbeddingsConfigStatus();
  if (!status.configured) {
    return { configured: false, provider: status.provider, embedding: null as number[] | null };
  }

  if ((process.env.EMBEDDINGS_PROVIDER || "").toLowerCase() !== "openai") {
    return { configured: false, provider: status.provider, embedding: null as number[] | null };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { configured: false, provider: "openai", embedding: null as number[] | null };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: input.content.slice(0, 8000)
      })
    });

    if (!response.ok) {
      throw new Error(`Embeddings request failed with ${response.status}`);
    }

    const payload = await response.json();
    const vector = payload.data?.[0]?.embedding;
    return {
      configured: true,
      provider: "openai",
      embedding: Array.isArray(vector) ? vector.map(Number) : null
    };
  } catch (error) {
    serverLog("embeddings.error", { error: error instanceof Error ? error.message : String(error) });
    return { configured: true, provider: "openai", embedding: null as number[] | null };
  }
}

export async function upsertEmbeddingRecord(input: {
  workspaceId?: string | null;
  entityType: string;
  entityId: string;
  content: string;
  sourceUrl?: string | null;
}) {
  const embedding = await createEmbedding({ content: input.content });
  return prisma.knowledgeEmbedding.upsert({
    where: { entityType_entityId: { entityType: input.entityType, entityId: input.entityId } },
    update: {
      workspaceId: input.workspaceId ?? null,
      content: input.content,
      embeddingJson: embedding.embedding as any,
      sourceUrl: input.sourceUrl ?? null
    },
    create: {
      workspaceId: input.workspaceId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      content: input.content,
      embeddingJson: embedding.embedding as any,
      sourceUrl: input.sourceUrl ?? null
    }
  });
}

-- CreateTable
CREATE TABLE "KnowledgeEmbedding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embeddingJson" JSONB,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeEmbedding_workspaceId_entityType_idx" ON "KnowledgeEmbedding"("workspaceId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEmbedding_entityType_entityId_key" ON "KnowledgeEmbedding"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "KnowledgeEmbedding" ADD CONSTRAINT "KnowledgeEmbedding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OfficialSource" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadataJson" JSONB,
  "lastFetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficialSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OfficialSource_url_key" ON "OfficialSource"("url");
CREATE INDEX IF NOT EXISTS "OfficialSource_active_sourceType_idx" ON "OfficialSource"("active", "sourceType");

ALTER TABLE "OfficialSource"
  ADD CONSTRAINT "OfficialSource_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialUpdate" ADD COLUMN IF NOT EXISTS "officialSourceId" TEXT;
ALTER TABLE "OfficialUpdate" ADD COLUMN IF NOT EXISTS "sourceMetadata" JSONB;
ALTER TABLE "OfficialUpdate" ADD COLUMN IF NOT EXISTS "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
  ALTER TABLE "OfficialUpdate"
    ADD CONSTRAINT "OfficialUpdate_officialSourceId_fkey"
    FOREIGN KEY ("officialSourceId") REFERENCES "OfficialSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "OfficialUpdate_sourceUrl_rawContentHash_key" ON "OfficialUpdate"("sourceUrl", "rawContentHash");
CREATE INDEX IF NOT EXISTS "OfficialUpdate_publishedAt_idx" ON "OfficialUpdate"("publishedAt");
CREATE INDEX IF NOT EXISTS "OfficialUpdate_updateType_idx" ON "OfficialUpdate"("updateType");

ALTER TABLE "MatterImpact" ADD COLUMN IF NOT EXISTS "actionRequired" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "MatterImpact_officialUpdateId_matterId_key" ON "MatterImpact"("officialUpdateId", "matterId");

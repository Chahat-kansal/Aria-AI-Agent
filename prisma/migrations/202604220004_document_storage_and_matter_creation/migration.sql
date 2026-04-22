ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientReference" TEXT;
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "matterReference" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_clientReference_key" ON "Client"("clientReference");
CREATE UNIQUE INDEX IF NOT EXISTS "Matter_matterReference_key" ON "Matter"("matterReference");

CREATE TABLE IF NOT EXISTS "DocumentStorageObject" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "data" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentStorageObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentStorageObject_documentId_key" ON "DocumentStorageObject"("documentId");

DO $$ BEGIN
  ALTER TABLE "DocumentStorageObject"
    ADD CONSTRAINT "DocumentStorageObject_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

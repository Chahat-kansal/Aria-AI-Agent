ALTER TABLE "WorkspaceOperationalSettings"
ADD COLUMN IF NOT EXISTS "integrationConnectionsJson" JSONB;

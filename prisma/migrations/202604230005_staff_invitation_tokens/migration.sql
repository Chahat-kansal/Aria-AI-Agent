ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteTokenHash_key" ON "User"("inviteTokenHash");
CREATE INDEX IF NOT EXISTS "User_workspaceId_status_idx" ON "User"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "User_inviteExpiresAt_idx" ON "User"("inviteExpiresAt");

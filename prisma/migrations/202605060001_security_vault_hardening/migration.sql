ALTER TABLE "MatterReviewRequest"
  ADD COLUMN "publicTokenHash" TEXT,
  ADD COLUMN "publicTokenPreview" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MatterReviewRequest_publicTokenHash_key" ON "MatterReviewRequest"("publicTokenHash");

ALTER TABLE "ClientIntakeRequest"
  ADD COLUMN "revokedAt" TIMESTAMP(3);

ALTER TABLE "ClientPortalAccessToken"
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3);

ALTER TABLE "DocumentRequest"
  ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE TABLE "SecurityIncident" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "reportedByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "affectedEntityType" TEXT,
  "affectedEntityId" TEXT,
  "containmentSteps" TEXT,
  "assessmentNotes" TEXT,
  "notificationStatus" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityIncident_workspaceId_createdAt_idx" ON "SecurityIncident"("workspaceId", "createdAt");
CREATE INDEX "SecurityIncident_severity_createdAt_idx" ON "SecurityIncident"("severity", "createdAt");

ALTER TABLE "SecurityIncident"
  ADD CONSTRAINT "SecurityIncident_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecurityIncident"
  ADD CONSTRAINT "SecurityIncident_reportedByUserId_fkey"
  FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

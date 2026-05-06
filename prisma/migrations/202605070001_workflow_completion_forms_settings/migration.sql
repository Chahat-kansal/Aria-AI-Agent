-- CreateEnum
CREATE TYPE "OfficialFormLifecycleStatus" AS ENUM ('CURRENT', 'NEEDS_REVIEW', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "OfficialFormSupportStatus" AS ENUM ('ONLINE_ONLY', 'MANUAL_ONLY', 'FILLABLE_PDF', 'MAPPING_REQUIRED');

-- CreateEnum
CREATE TYPE "MatterOfficialFormDraftStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'PUBLISHED', 'UNSUPPORTED');

-- AlterTable
ALTER TABLE "ClientPortalAccessToken"
ADD COLUMN "createdByUserId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceOperationalSettings" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientPortalExpiryDays" INTEGER NOT NULL DEFAULT 30,
  "clientPortalConsentNotice" TEXT,
  "clientPortalHelpText" TEXT,
  "clientPortalEmailTemplate" TEXT,
  "aiDraftAutofillEnabled" BOOLEAN NOT NULL DEFAULT true,
  "aiReviewRequiredDefault" BOOLEAN NOT NULL DEFAULT true,
  "aiNoticeText" TEXT,
  "documentAllowedMimeTypesJson" JSONB,
  "documentMaxUploadBytes" INTEGER NOT NULL DEFAULT 10485760,
  "documentCategoriesJson" JSONB,
  "appointmentTimezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
  "appointmentTypesJson" JSONB,
  "appointmentAvailabilityJson" JSONB,
  "appointmentMeetingMethodsJson" JSONB,
  "appointmentBufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  "appointmentBufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  "appointmentMaxBookingsPerDay" INTEGER,
  "appointmentMinNoticeHours" INTEGER NOT NULL DEFAULT 24,
  "appointmentCutoffHours" INTEGER NOT NULL DEFAULT 24,
  "appointmentRequestFallback" BOOLEAN NOT NULL DEFAULT true,
  "formsDefaultSettingsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceOperationalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialFormTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "createdByUserId" TEXT,
  "sourceType" TEXT NOT NULL,
  "formNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceName" TEXT,
  "versionLabel" TEXT,
  "designDate" TEXT,
  "subclassCodes" TEXT[],
  "lifecycleStatus" "OfficialFormLifecycleStatus" NOT NULL DEFAULT 'CURRENT',
  "supportStatus" "OfficialFormSupportStatus" NOT NULL DEFAULT 'MAPPING_REQUIRED',
  "isFirmProvided" BOOLEAN NOT NULL DEFAULT false,
  "downloadedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "syncError" TEXT,
  "checksum" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileData" BYTEA,
  "fieldSchemaJson" JSONB,
  "fieldMappingsJson" JSONB,
  "mappingNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficialFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterOfficialFormDraft" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "status" "MatterOfficialFormDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "generatedFileName" TEXT,
  "generatedPdfData" BYTEA,
  "fieldValuesJson" JSONB,
  "warningsJson" JSONB,
  "publishedToClientAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatterOfficialFormDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceOperationalSettings_workspaceId_key" ON "WorkspaceOperationalSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialFormTemplate_workspaceId_formNumber_sourceUrl_key" ON "OfficialFormTemplate"("workspaceId", "formNumber", "sourceUrl");

-- CreateIndex
CREATE INDEX "OfficialFormTemplate_workspaceId_formNumber_idx" ON "OfficialFormTemplate"("workspaceId", "formNumber");

-- CreateIndex
CREATE INDEX "OfficialFormTemplate_supportStatus_lifecycleStatus_idx" ON "OfficialFormTemplate"("supportStatus", "lifecycleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MatterOfficialFormDraft_matterId_templateId_key" ON "MatterOfficialFormDraft"("matterId", "templateId");

-- CreateIndex
CREATE INDEX "MatterOfficialFormDraft_workspaceId_status_idx" ON "MatterOfficialFormDraft"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "ClientPortalAccessToken"
ADD CONSTRAINT "ClientPortalAccessToken_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOperationalSettings"
ADD CONSTRAINT "WorkspaceOperationalSettings_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialFormTemplate"
ADD CONSTRAINT "OfficialFormTemplate_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialFormTemplate"
ADD CONSTRAINT "OfficialFormTemplate_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterOfficialFormDraft"
ADD CONSTRAINT "MatterOfficialFormDraft_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterOfficialFormDraft"
ADD CONSTRAINT "MatterOfficialFormDraft_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterOfficialFormDraft"
ADD CONSTRAINT "MatterOfficialFormDraft_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "OfficialFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterOfficialFormDraft"
ADD CONSTRAINT "MatterOfficialFormDraft_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterOfficialFormDraft"
ADD CONSTRAINT "MatterOfficialFormDraft_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

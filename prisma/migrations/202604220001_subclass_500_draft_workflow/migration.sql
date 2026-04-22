-- Subclass-specific draft application workflow foundation.

CREATE TYPE "TemplateValueType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'BOOLEAN', 'CURRENCY', 'SELECT', 'MULTI_SELECT');
CREATE TYPE "DraftStatus" AS ENUM ('DRAFTING', 'READY_FOR_AGENT_REVIEW', 'AGENT_REVIEWED', 'READY_FOR_CLIENT_REVIEW', 'SENT_TO_CLIENT', 'CLIENT_CONFIRMED', 'RETURNED_TO_AGENT', 'NEEDS_WORK');
CREATE TYPE "DraftFieldStatus" AS ENUM ('HIGH_CONFIDENCE', 'SUPPORTED', 'NEEDS_REVIEW', 'CONFLICTING', 'MISSING', 'VERIFIED');
CREATE TYPE "ReviewRequestStatus" AS ENUM ('REVIEW_REQUESTED', 'SENT_TO_CLIENT', 'VIEWED_BY_CLIENT', 'SIGNED_CONFIRMED', 'RETURNED_TO_AGENT', 'REQUIRES_FOLLOW_UP');

CREATE TABLE "VisaSubclassTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "subclassCode" TEXT NOT NULL,
  "stream" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisaSubclassTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisaTemplateSection" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "VisaTemplateSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisaTemplateField" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "helpText" TEXT,
  "valueType" "TemplateValueType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "supportedDocumentCategories" TEXT[],
  "validationRules" JSONB,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "VisaTemplateField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisaTemplateRequirement" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "ruleKey" TEXT NOT NULL,
  "metadataJson" JSONB,
  CONSTRAINT "VisaTemplateRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisaTemplateChecklistItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "metadataJson" JSONB,
  CONSTRAINT "VisaTemplateChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterApplicationDraft" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "status" "DraftStatus" NOT NULL DEFAULT 'DRAFTING',
  "readinessScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatterApplicationDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterDraftField" (
  "id" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "templateFieldId" TEXT NOT NULL,
  "value" TEXT,
  "confidence" DOUBLE PRECISION,
  "sourceSnippet" TEXT,
  "sourcePageRef" TEXT,
  "status" "DraftFieldStatus" NOT NULL DEFAULT 'MISSING',
  "reviewedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "manualOverride" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatterDraftField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterDraftFieldEvidenceLink" (
  "id" TEXT NOT NULL,
  "draftFieldId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sourceSnippet" TEXT,
  "sourcePageRef" TEXT,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatterDraftFieldEvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentExtractionResult" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "extractedJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExtractionResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterReviewRequest" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "status" "ReviewRequestStatus" NOT NULL DEFAULT 'REVIEW_REQUESTED',
  "recipientEmail" TEXT,
  "recipientName" TEXT,
  "message" TEXT,
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatterReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisaSubclassTemplate_workspaceId_subclassCode_stream_version_key" ON "VisaSubclassTemplate"("workspaceId", "subclassCode", "stream", "version");
CREATE INDEX "VisaSubclassTemplate_subclassCode_stream_active_idx" ON "VisaSubclassTemplate"("subclassCode", "stream", "active");
CREATE UNIQUE INDEX "VisaTemplateSection_templateId_key_key" ON "VisaTemplateSection"("templateId", "key");
CREATE UNIQUE INDEX "VisaTemplateField_templateId_fieldKey_key" ON "VisaTemplateField"("templateId", "fieldKey");
CREATE UNIQUE INDEX "VisaTemplateRequirement_templateId_ruleKey_key" ON "VisaTemplateRequirement"("templateId", "ruleKey");
CREATE UNIQUE INDEX "MatterApplicationDraft_matterId_templateId_key" ON "MatterApplicationDraft"("matterId", "templateId");
CREATE UNIQUE INDEX "MatterDraftField_draftId_templateFieldId_key" ON "MatterDraftField"("draftId", "templateFieldId");

ALTER TABLE "VisaSubclassTemplate" ADD CONSTRAINT "VisaSubclassTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisaTemplateSection" ADD CONSTRAINT "VisaTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisaSubclassTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisaTemplateField" ADD CONSTRAINT "VisaTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisaSubclassTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisaTemplateField" ADD CONSTRAINT "VisaTemplateField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VisaTemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisaTemplateRequirement" ADD CONSTRAINT "VisaTemplateRequirement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisaSubclassTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisaTemplateChecklistItem" ADD CONSTRAINT "VisaTemplateChecklistItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisaSubclassTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterApplicationDraft" ADD CONSTRAINT "MatterApplicationDraft_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterApplicationDraft" ADD CONSTRAINT "MatterApplicationDraft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisaSubclassTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatterDraftField" ADD CONSTRAINT "MatterDraftField_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "MatterApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterDraftField" ADD CONSTRAINT "MatterDraftField_templateFieldId_fkey" FOREIGN KEY ("templateFieldId") REFERENCES "VisaTemplateField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatterDraftFieldEvidenceLink" ADD CONSTRAINT "MatterDraftFieldEvidenceLink_draftFieldId_fkey" FOREIGN KEY ("draftFieldId") REFERENCES "MatterDraftField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterDraftFieldEvidenceLink" ADD CONSTRAINT "MatterDraftFieldEvidenceLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionResult" ADD CONSTRAINT "DocumentExtractionResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterReviewRequest" ADD CONSTRAINT "MatterReviewRequest_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterReviewRequest" ADD CONSTRAINT "MatterReviewRequest_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "MatterApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

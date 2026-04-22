-- Initial schema for Aria for Migration Agents
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN CREATE TYPE "WorkspacePlan" AS ENUM ('STARTER', 'GROWTH', 'PRO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT', 'REVIEWER', 'OPS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MatterStatus" AS ENUM ('IN_PROGRESS', 'AWAITING_DOCS', 'READY_FOR_REVIEW', 'DRAFT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MatterStage" AS ENUM ('INTAKE', 'EVIDENCE', 'FIELD_REVIEW', 'VALIDATION', 'SUBMISSION_PREP'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ExtractionStatus" AS ENUM ('QUEUED', 'EXTRACTED', 'NEEDS_REVIEW'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "FieldStatus" AS ENUM ('HIGH_CONFIDENCE', 'SUPPORTED', 'NEEDS_REVIEW', 'CONFLICTING', 'MISSING', 'VERIFIED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ResolutionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ImpactStatus" AS ENUM ('NEW', 'REVIEWING', 'ACTIONED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ChatRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "plan" "WorkspacePlan" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "role" "UserRole" NOT NULL,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dob" TIMESTAMPTZ NOT NULL,
  "nationality" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Matter" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "visaSubclass" TEXT NOT NULL,
  "visaStream" TEXT NOT NULL,
  "status" "MatterStatus" NOT NULL,
  "stage" "MatterStage" NOT NULL,
  "lodgementTargetDate" TIMESTAMPTZ,
  "assignedToUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "readinessScore" INTEGER NOT NULL,
  "lastReviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "matterId" TEXT NOT NULL REFERENCES "Matter"("id") ON DELETE CASCADE,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subcategory" TEXT,
  "uploadedByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "extractionStatus" "ExtractionStatus" NOT NULL,
  "reviewStatus" "ReviewStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ExtractedField" (
  "id" TEXT PRIMARY KEY,
  "matterId" TEXT NOT NULL REFERENCES "Matter"("id") ON DELETE CASCADE,
  "documentId" TEXT NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
  "fieldKey" TEXT NOT NULL,
  "fieldLabel" TEXT NOT NULL,
  "fieldValue" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "sourceSnippet" TEXT NOT NULL,
  "sourcePageRef" TEXT NOT NULL,
  "status" "FieldStatus" NOT NULL,
  "needsReview" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ValidationIssue" (
  "id" TEXT PRIMARY KEY,
  "matterId" TEXT NOT NULL REFERENCES "Matter"("id") ON DELETE CASCADE,
  "severity" "IssueSeverity" NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "relatedFieldKey" TEXT,
  "resolutionStatus" "ResolutionStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ChecklistItem" (
  "id" TEXT PRIMARY KEY,
  "matterId" TEXT NOT NULL REFERENCES "Matter"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL,
  "notes" TEXT
);

CREATE TABLE IF NOT EXISTS "OfficialUpdate" (
  "id" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "updateType" TEXT NOT NULL,
  "effectiveDate" TIMESTAMPTZ,
  "publishedAt" TIMESTAMPTZ NOT NULL,
  "rawContentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "MatterImpact" (
  "id" TEXT PRIMARY KEY,
  "officialUpdateId" TEXT NOT NULL REFERENCES "OfficialUpdate"("id") ON DELETE CASCADE,
  "matterId" TEXT NOT NULL REFERENCES "Matter"("id") ON DELETE CASCADE,
  "impactLevel" "ImpactLevel" NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ImpactStatus" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "matterId" TEXT NOT NULL REFERENCES "Matter"("id") ON DELETE CASCADE,
  "assignedToUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "dueDate" TIMESTAMPTZ NOT NULL,
  "status" "TaskStatus" NOT NULL,
  "priority" "TaskPriority" NOT NULL
);

CREATE TABLE IF NOT EXISTS "AiChatThread" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "matterId" TEXT REFERENCES "Matter"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AiChatMessage" (
  "id" TEXT PRIMARY KEY,
  "threadId" TEXT NOT NULL REFERENCES "AiChatThread"("id") ON DELETE CASCADE,
  "role" "ChatRole" NOT NULL,
  "content" TEXT NOT NULL,
  "citationsJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

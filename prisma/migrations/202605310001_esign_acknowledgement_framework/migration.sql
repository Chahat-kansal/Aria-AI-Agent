-- CreateEnum
CREATE TYPE "EsignStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SUBMITTED', 'REVOKED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AcknowledgementReviewStatus" AS ENUM ('AGENT_REVIEW_REQUIRED', 'REVIEWED', 'FLAGGED');

-- CreateTable
CREATE TABLE "ClientAcknowledgementRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EsignStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "safeSummary" TEXT,
    "requestJson" TEXT,
    "externalEnvelopeId" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastErrorSummary" TEXT,
    "latestClientSessionId" TEXT,
    "latestClientIpHash" TEXT,
    "latestUserAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAcknowledgementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAcknowledgementResponse" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reviewStatus" "AcknowledgementReviewStatus" NOT NULL DEFAULT 'AGENT_REVIEW_REQUIRED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientSessionId" TEXT,
    "clientIpHash" TEXT,
    "userAgentHash" TEXT,
    "responseJson" TEXT,
    "safeSummary" TEXT,
    "riskFlagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAcknowledgementResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcknowledgementRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "responseId" TEXT,
    "provider" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "safeSummary" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
    "recordContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcknowledgementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsignEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "matterId" TEXT,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "provider" TEXT NOT NULL,
    "status" "EsignStatus" NOT NULL DEFAULT 'DRAFT',
    "action" TEXT NOT NULL,
    "lastErrorSummary" TEXT,
    "payloadPreviewJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientAcknowledgementRequest_workspaceId_status_createdAt_idx" ON "ClientAcknowledgementRequest"("workspaceId", "status", "createdAt");
CREATE INDEX "ClientAcknowledgementRequest_matterId_status_createdAt_idx" ON "ClientAcknowledgementRequest"("matterId", "status", "createdAt");
CREATE INDEX "ClientAcknowledgementRequest_clientId_status_createdAt_idx" ON "ClientAcknowledgementRequest"("clientId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAcknowledgementResponse_requestId_key" ON "ClientAcknowledgementResponse"("requestId");
CREATE INDEX "ClientAcknowledgementResponse_workspaceId_reviewStatus_submittedAt_idx" ON "ClientAcknowledgementResponse"("workspaceId", "reviewStatus", "submittedAt");
CREATE INDEX "ClientAcknowledgementResponse_matterId_reviewStatus_submittedAt_idx" ON "ClientAcknowledgementResponse"("matterId", "reviewStatus", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcknowledgementRecord_requestId_key" ON "AcknowledgementRecord"("requestId");
CREATE INDEX "AcknowledgementRecord_workspaceId_createdAt_idx" ON "AcknowledgementRecord"("workspaceId", "createdAt");
CREATE INDEX "AcknowledgementRecord_matterId_createdAt_idx" ON "AcknowledgementRecord"("matterId", "createdAt");

-- CreateIndex
CREATE INDEX "EsignEvent_workspaceId_status_createdAt_idx" ON "EsignEvent"("workspaceId", "status", "createdAt");
CREATE INDEX "EsignEvent_provider_action_createdAt_idx" ON "EsignEvent"("provider", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientAcknowledgementRequest" ADD CONSTRAINT "ClientAcknowledgementRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAcknowledgementRequest" ADD CONSTRAINT "ClientAcknowledgementRequest_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAcknowledgementRequest" ADD CONSTRAINT "ClientAcknowledgementRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAcknowledgementRequest" ADD CONSTRAINT "ClientAcknowledgementRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAcknowledgementResponse" ADD CONSTRAINT "ClientAcknowledgementResponse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAcknowledgementResponse" ADD CONSTRAINT "ClientAcknowledgementResponse_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAcknowledgementResponse" ADD CONSTRAINT "ClientAcknowledgementResponse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientAcknowledgementResponse" ADD CONSTRAINT "ClientAcknowledgementResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientAcknowledgementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcknowledgementRecord" ADD CONSTRAINT "AcknowledgementRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcknowledgementRecord" ADD CONSTRAINT "AcknowledgementRecord_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcknowledgementRecord" ADD CONSTRAINT "AcknowledgementRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcknowledgementRecord" ADD CONSTRAINT "AcknowledgementRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientAcknowledgementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EsignEvent" ADD CONSTRAINT "EsignEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EsignEvent" ADD CONSTRAINT "EsignEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EsignEvent" ADD CONSTRAINT "EsignEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientAcknowledgementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EsignEvent" ADD CONSTRAINT "EsignEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

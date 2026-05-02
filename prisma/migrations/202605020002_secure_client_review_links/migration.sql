ALTER TABLE "MatterReviewRequest"
  ADD COLUMN IF NOT EXISTS "publicToken" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "MatterReviewRequest_publicToken_key"
  ON "MatterReviewRequest"("publicToken");

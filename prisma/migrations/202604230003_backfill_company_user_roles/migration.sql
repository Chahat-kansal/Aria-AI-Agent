UPDATE "User" SET "role" = 'COMPANY_OWNER' WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'MIGRATION_AGENT' WHERE "role" = 'AGENT';
UPDATE "User" SET "role" = 'SENIOR_MIGRATION_AGENT' WHERE "role" = 'REVIEWER';
UPDATE "User" SET "role" = 'ADMIN_ASSISTANT' WHERE "role" = 'OPS';

UPDATE "User"
SET "visibilityScope" = 'FIRM_WIDE'
WHERE "role" IN ('COMPANY_OWNER', 'COMPANY_ADMIN', 'PRINCIPAL_REGISTERED_MIGRATION_AGENT');

UPDATE "Client" c
SET "assignedToUserId" = m."assignedToUserId"
FROM "Matter" m
WHERE m."clientId" = c."id"
  AND c."assignedToUserId" IS NULL;

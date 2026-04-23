ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "permissionsJson" JSONB;

UPDATE "User"
SET "permissionsJson" = jsonb_build_object(
  'can_view_all_matters', true,
  'can_edit_matters', true,
  'can_manage_team', true,
  'can_access_ai', true,
  'can_access_visa_knowledge', true,
  'can_run_cross_check', true,
  'can_view_financial_data', true
)
WHERE "role" = 'COMPANY_OWNER'
  AND "permissionsJson" IS NULL;

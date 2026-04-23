UPDATE "User"
SET "permissionsJson" = COALESCE("permissionsJson", '{}'::jsonb)
  || jsonb_build_object(
    'can_access_ai', true,
    'can_run_pathway_analysis', COALESCE(("permissionsJson"->>'can_run_pathway_analysis')::boolean, COALESCE(("permissionsJson"->>'can_access_ai')::boolean, true)),
    'can_access_update_monitor', COALESCE(("permissionsJson"->>'can_access_update_monitor')::boolean, COALESCE(("permissionsJson"->>'can_access_ai')::boolean, true))
  )
WHERE "status" != 'DISABLED';

UPDATE "User"
SET "permissionsJson" = COALESCE("permissionsJson", '{}'::jsonb)
  || jsonb_build_object(
    'can_manage_team', true,
    'can_access_ai', true,
    'can_access_visa_knowledge', true,
    'can_run_pathway_analysis', true,
    'can_view_all_matters', true,
    'can_edit_matters', true,
    'can_run_cross_check', true,
    'can_view_financial_data', true,
    'can_access_update_monitor', true
  )
WHERE "role" = 'COMPANY_OWNER';

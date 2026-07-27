-- Synthetic service-role fixture for manual clean-baseline smoke tests.
-- Apply only to a disposable database after replacing fixture_user_id with an auth user.
\set fixture_user_id '10000000-0000-0000-0000-000000000001'

insert into public.workspaces (id, name, slug, created_by)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Example Workspace',
  'example-workspace',
  :'fixture_user_id'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  'a0000000-0000-0000-0000-000000000001',
  :'fixture_user_id',
  'owner'
);

-- The complete lifecycle fixture is exercised transactionally by
-- supabase/tests/database/tenant_workflow.test.sql. It creates a profile version,
-- campaign, snapshot, strategy, run, company, qualification, contact and draft.


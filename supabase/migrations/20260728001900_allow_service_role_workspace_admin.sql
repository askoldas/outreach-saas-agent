-- Allow trusted background workers to call workspace-scoped security-definer RPCs.
-- The service role already bypasses RLS; user sessions still require active admin membership.

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.role() = 'service_role' or exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_workspace_admin(uuid) from public, anon;
grant execute on function public.is_workspace_admin(uuid)
to authenticated, service_role;

drop policy if exists organization_relationship_memories_v2_select
  on public.organization_relationship_memories_v2;

create policy organization_relationship_memories_v2_select
  on public.organization_relationship_memories_v2
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

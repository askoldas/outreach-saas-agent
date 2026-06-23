create or replace function public.create_workspace(
  workspace_name text,
  workspace_website_url text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate_slug text;
  suffix int := 0;
  created_workspace public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(workspace_name, ''))) < 2 then
    raise exception 'Workspace name must contain at least 2 characters';
  end if;

  base_slug := public.slugify_workspace_name(workspace_name);

  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  candidate_slug := base_slug;

  while exists (select 1 from public.workspaces where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.workspaces (name, slug, website_url, created_by)
  values (
    trim(workspace_name),
    candidate_slug,
    nullif(trim(coalesce(workspace_website_url, '')), ''),
    auth.uid()
  )
  returning * into created_workspace;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (created_workspace.id, auth.uid(), 'owner', 'active');

  return created_workspace;
end;
$$;

revoke execute on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;

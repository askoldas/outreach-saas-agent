drop function if exists public.create_workspace(text);

create function public.create_workspace(
  workspace_name text,
  workspace_website_url text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.workspaces;
  candidate_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(coalesce(workspace_name, ''))) not between 2 and 120 then
    raise exception 'Invalid workspace name';
  end if;

  candidate_slug := public.slugify_workspace_name(workspace_name);
  if candidate_slug = '' then candidate_slug := 'workspace'; end if;
  candidate_slug := candidate_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.workspaces (name, slug, website_url, created_by)
  values (
    trim(workspace_name),
    candidate_slug,
    nullif(trim(coalesce(workspace_website_url, '')), ''),
    auth.uid()
  )
  returning * into created;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created.id, auth.uid(), 'owner');

  return created;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

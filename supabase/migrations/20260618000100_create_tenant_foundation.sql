create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  website_url text,
  default_locale text not null default 'en',
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_workspace_role_idx on public.workspace_members(workspace_id, role);

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.current_workspace_role(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  limit 1;
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_workspace_role(target_workspace_id) in ('owner', 'admin'), false);
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_workspace_role(target_workspace_id) = 'owner', false);
$$;

create policy "Members can read workspaces"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

create policy "Authenticated users can create owned workspaces"
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

create policy "Workspace admins can update workspaces"
on public.workspaces
for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

create policy "Members can read workspace members"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Creators can add themselves as owner"
on public.workspace_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and status = 'active'
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_id
      and w.created_by = auth.uid()
  )
);

create policy "Workspace owners can manage members"
on public.workspace_members
for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create or replace function public.slugify_workspace_name(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, 'workspace')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_workspace(
  workspace_name text,
  workspace_website_url text default null
)
returns public.workspaces
language plpgsql
security invoker
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
  values (trim(workspace_name), candidate_slug, nullif(trim(coalesce(workspace_website_url, '')), ''), auth.uid())
  returning * into created_workspace;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (created_workspace.id, auth.uid(), 'owner', 'active');

  return created_workspace;
end;
$$;

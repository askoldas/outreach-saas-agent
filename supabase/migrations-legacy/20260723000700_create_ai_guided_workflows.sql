create table public.ai_guided_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in (
    'company', 'offering', 'campaign', 'lead_discovery',
    'qualification', 'messaging', 'sequence'
  )),
  entity_id text not null,
  base_version int not null default 0 check (base_version >= 0),
  current_step text not null,
  completed_steps text[] not null default '{}',
  draft_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft_data) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'applied', 'discarded')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, scope, entity_id)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('company', 'offering', 'campaign', 'lead', 'sequence')),
  entity_id text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, scope, entity_id, created_by)
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(trim(content)) between 1 and 10000),
  guided_response jsonb check (
    guided_response is null or jsonb_typeof(guided_response) = 'object'
  ),
  created_at timestamptz not null default now()
);

create table public.ai_applied_changes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  proposal_id text,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in (
    'set', 'add', 'remove', 'replace', 'merge', 'classify', 'create'
  )),
  field_path text,
  previous_value jsonb,
  applied_value jsonb not null,
  source text not null check (source in (
    'guided_selection', 'natural_language', 'ai_recommendation', 'direct_edit'
  )),
  base_version int check (base_version is null or base_version >= 0),
  applied_by_user_id uuid not null references auth.users(id) on delete restrict,
  applied_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by_user_id uuid references auth.users(id) on delete restrict
);

create index ai_guided_drafts_workspace_idx
on public.ai_guided_drafts(workspace_id, scope, updated_at desc);
create index ai_conversations_workspace_idx
on public.ai_conversations(workspace_id, scope, updated_at desc);
create index ai_messages_conversation_idx
on public.ai_messages(conversation_id, created_at);
create index ai_applied_changes_entity_idx
on public.ai_applied_changes(workspace_id, entity_type, entity_id, applied_at desc);

create trigger ai_guided_drafts_set_updated_at
before update on public.ai_guided_drafts
for each row execute function public.set_updated_at();
create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

alter table public.ai_guided_drafts enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_applied_changes enable row level security;

create policy "Members can read guided drafts"
on public.ai_guided_drafts for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "Members can create guided drafts"
on public.ai_guided_drafts for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "Members can update guided drafts"
on public.ai_guided_drafts for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members can read scoped AI conversations"
on public.ai_conversations for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "Members can create scoped AI conversations"
on public.ai_conversations for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "Members can read scoped AI messages"
on public.ai_messages for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "Members can create scoped AI messages"
on public.ai_messages for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.ai_conversations conversation
    where conversation.id = conversation_id
      and conversation.workspace_id = workspace_id
  )
);

create policy "Members can read applied AI changes"
on public.ai_applied_changes for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "Members can record applied AI changes"
on public.ai_applied_changes for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and applied_by_user_id = auth.uid()
);
create policy "Members can mark their applied AI changes undone"
on public.ai_applied_changes for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create or replace function public.clear_guided_workflow_data_with_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ai_applied_changes where workspace_id = old.workspace_id;
  delete from public.ai_conversations where workspace_id = old.workspace_id;
  delete from public.ai_guided_drafts where workspace_id = old.workspace_id;
  return old;
end;
$$;

create trigger company_profile_clear_guided_workflow_data
after delete on public.company_profiles
for each row execute function public.clear_guided_workflow_data_with_profile();

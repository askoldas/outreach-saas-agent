-- WP-21 preparation: rollout audit and a non-destructive workspace rollback.
-- This migration does not enable V2 for any workspace.

create table public.intelligence_rollout_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'readiness_checked',
      'controlled_beta_enabled',
      'controlled_beta_rejected',
      'rolled_back_to_v1'
    )),
  previous_settings_json jsonb not null
    check (jsonb_typeof(previous_settings_json) = 'object'),
  next_settings_json jsonb not null
    check (jsonb_typeof(next_settings_json) = 'object'),
  evidence_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_json) = 'object'),
  reason text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index intelligence_rollout_audit_events_workspace_idx
on public.intelligence_rollout_audit_events(workspace_id, created_at desc);

alter table public.intelligence_rollout_audit_events enable row level security;

create policy "Members can read Intelligence rollout audit events"
on public.intelligence_rollout_audit_events for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.rollback_workspace_intelligence_v2(
  target_workspace_id uuid,
  target_reason text
)
returns public.workspace_intelligence_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_settings public.workspace_intelligence_settings;
  next_settings public.workspace_intelligence_settings;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if length(trim(coalesce(target_reason, ''))) < 8 then
    raise exception 'A rollback reason is required';
  end if;

  select * into previous_settings
  from public.workspace_intelligence_settings
  where workspace_id = target_workspace_id
  for update;

  if previous_settings.workspace_id is null then
    raise exception 'Workspace Intelligence settings were not found';
  end if;

  update public.workspace_intelligence_settings
  set
    profile_version = 'v1',
    campaign_workflow = 'v1',
    shadow_mode = false,
    result_write_mode = 'none',
    updated_by = auth.uid()
  where workspace_id = target_workspace_id
  returning * into next_settings;

  insert into public.intelligence_rollout_audit_events (
    workspace_id,
    event_type,
    previous_settings_json,
    next_settings_json,
    evidence_json,
    reason,
    actor_user_id
  ) values (
    target_workspace_id,
    'rolled_back_to_v1',
    to_jsonb(previous_settings),
    to_jsonb(next_settings),
    jsonb_build_object(
      'preservedV2CampaignCount',
      (
        select count(*)
        from public.campaigns
        where workspace_id = target_workspace_id
          and workflow_version = 'v2'
      ),
      'activeV2RunCount',
      (
        select count(*)
        from public.campaign_runs
        where workspace_id = target_workspace_id
          and workflow_version = 'v2'
          and status in ('queued', 'running', 'paused')
      )
    ),
    trim(target_reason),
    auth.uid()
  );

  return next_settings;
end;
$$;

revoke all on table public.intelligence_rollout_audit_events
from anon, authenticated;
grant select on table public.intelligence_rollout_audit_events
to authenticated;

revoke all on function public.rollback_workspace_intelligence_v2(uuid, text)
from public, anon;
grant execute on function public.rollback_workspace_intelligence_v2(uuid, text)
to authenticated;

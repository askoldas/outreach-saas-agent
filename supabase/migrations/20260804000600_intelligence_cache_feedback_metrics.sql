-- Exact cache reuse events plus review outcomes from their authoritative domain tables.
create table public.intelligence_runtime_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id text not null,
  event_type text not null check (event_type in ('cache_hit')),
  cache_key text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index intelligence_runtime_events_metrics_idx
on public.intelligence_runtime_events(workspace_id, task_id, created_at desc);

alter table public.intelligence_runtime_events enable row level security;
create policy "Members can read Intelligence runtime events"
on public.intelligence_runtime_events for select to authenticated
using (public.is_workspace_member(workspace_id));
revoke insert, update, delete on public.intelligence_runtime_events from authenticated, anon;
grant select on public.intelligence_runtime_events to authenticated;
grant select, insert on public.intelligence_runtime_events to service_role;

create or replace function public.get_intelligence_feedback_metrics(
  target_workspace_id uuid,
  target_since timestamptz default (now() - interval '24 hours')
)
returns table (
  metric_scope text,
  task_id text,
  cache_hits bigint,
  cache_misses bigint,
  cache_reuse_rate numeric,
  reviewed_outputs bigint,
  user_edits bigint,
  user_rejections bigint,
  user_edit_rate numeric,
  user_rejection_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_since > now() or target_since < now() - interval '90 days' then
    raise exception 'Intelligence feedback metrics window must be within the last 90 days';
  end if;
  if auth.role() <> 'service_role' and not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized to inspect Intelligence feedback metrics';
  end if;

  return query
  with cache_hits as (
    select events.task_id, count(*) as hits
    from public.intelligence_runtime_events events
    where events.workspace_id = target_workspace_id and events.created_at >= target_since
    group by events.task_id
  ), cache_misses as (
    select attempts.task_id, count(*) as misses
    from public.intelligence_ai_attempts attempts
    where attempts.workspace_id = target_workspace_id
      and attempts.status = 'completed'
      and attempts.created_at >= target_since
    group by attempts.task_id
  ), cache as (
    select
      coalesce(cache_hits.task_id, cache_misses.task_id) as task_id,
      coalesce(cache_hits.hits, 0) as hits,
      coalesce(cache_misses.misses, 0) as misses
    from cache_hits full join cache_misses using (task_id)
  ), feedback as (
    select 'outreach.grounded_draft'::text as task_id,
      count(*) filter (where status in ('approved', 'edited', 'rejected')) as reviewed,
      count(*) filter (where status = 'edited') as edits,
      count(*) filter (where status = 'rejected') as rejections
    from public.outreach_drafts
    where workspace_id = target_workspace_id and updated_at >= target_since
    union all
    select 'candidate.qualification_review', count(*), 0,
      count(*) filter (where decision in ('rejected', 'excluded'))
    from public.candidate_review_decisions_v2
    where workspace_id = target_workspace_id and created_at >= target_since
    union all
    select 'company_profile.review', count(*),
      count(*) filter (where event_type in ('profile_core_updated', 'offering_intelligence_updated')),
      count(*) filter (
        where event_type in ('archetype_reviewed', 'rule_reviewed')
          and details_json->>'status' in ('user_rejected', 'rejected')
      )
    from public.profile_change_events
    where workspace_id = target_workspace_id
      and actor_type = 'user'
      and created_at >= target_since
  ), scopes as (
    select 'cache'::text as metric_scope, cache.task_id, cache.hits, cache.misses,
      0::bigint as reviewed, 0::bigint as edits, 0::bigint as rejections
    from cache
    union all
    select 'feedback', feedback.task_id, 0, 0, feedback.reviewed, feedback.edits,
      feedback.rejections
    from feedback
  )
  select scopes.metric_scope, scopes.task_id,
    scopes.hits, scopes.misses,
    round(scopes.hits::numeric / nullif(scopes.hits + scopes.misses, 0), 4),
    scopes.reviewed, scopes.edits, scopes.rejections,
    round(scopes.edits::numeric / nullif(scopes.reviewed, 0), 4),
    round(scopes.rejections::numeric / nullif(scopes.reviewed, 0), 4)
  from scopes
  where scopes.hits + scopes.misses + scopes.reviewed > 0
  order by scopes.metric_scope, scopes.task_id;
end;
$$;

revoke all on function public.get_intelligence_feedback_metrics(uuid, timestamptz) from public, anon;
grant execute on function public.get_intelligence_feedback_metrics(uuid, timestamptz) to authenticated, service_role;

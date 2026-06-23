alter table public.leads
add column qualification_status text not null default 'needs_manual_review' check (
  qualification_status in (
    'pending',
    'qualified',
    'failed',
    'needs_manual_review',
    'non_ai_manual_review'
  )
),
add column qualification_error text;

create index leads_workspace_qualification_status_idx
on public.leads(workspace_id, qualification_status);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_kind text not null default 'person' check (contact_kind in ('person', 'department', 'company')),
  full_name text,
  job_title text,
  department text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_kind <> 'person' or full_name is not null),
  unique (workspace_id, id)
);

create table public.contact_methods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  method_type text not null check (method_type in ('email', 'phone', 'linkedin_url', 'contact_form', 'general_company_email', 'website')),
  value text not null,
  normalized_value text not null,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'source_confirmed', 'verified', 'invalid', 'unknown')),
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, method_type, normalized_value)
);

create table public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  contact_method_id uuid references public.contact_methods(id) on delete cascade,
  provider text not null,
  source_url text not null,
  source_title text not null default '',
  query text,
  retrieved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (contact_id is not null or contact_method_id is not null)
);

create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  contact_method_id uuid references public.contact_methods(id) on delete set null,
  role_relevance text not null default '',
  selection_status text not null default 'candidate' check (selection_status in ('candidate', 'recommended', 'selected', 'rejected')),
  recommendation_reason text not null default '',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (contact_id is not null or contact_method_id is not null)
);

create table public.contact_enrichments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'not_found', 'failed')),
  idempotency_key text not null,
  result_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(result_summary) = 'object'),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_method_id uuid not null references public.contact_methods(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('valid', 'invalid', 'risky', 'unknown')),
  provider_reference text,
  verified_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);


-- GENERATED FILE: edit supabase/baseline/*.sql and run:
-- node scripts/build-clean-baseline.mjs
-- Clean baseline for a brand-new empty Opptium Supabase project.

-- Source: supabase/baseline/001_extensions.sql

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

-- Source: supabase/baseline/002_tenancy.sql

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  label text not null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

-- Source: supabase/baseline/003_company_profiles.sql

create table public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.company_profile_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  version integer not null check (version > 0),
  company_name text not null default '',
  website_url text,
  summary text not null default '',
  structured_profile jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_profile) = 'object'),
  extracted_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(extracted_facts) = 'array'),
  review_questions jsonb not null default '[]'::jsonb check (jsonb_typeof(review_questions) = 'array'),
  profile_status text not null default 'draft' check (profile_status in ('draft', 'needs_input', 'ready', 'published')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  provenance text not null default 'manual' check (provenance in ('workspace', 'manual', 'website_analysis', 'import')),
  analysis_prompt_version text,
  analysis_model_config_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_profile_id, version),
  unique (workspace_id, id)
);

alter table public.company_profiles
  add constraint company_profiles_current_version_fk
  foreign key (current_version_id) references public.company_profile_versions(id) on delete restrict;

create table public.campaign_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  company_profile_version_id uuid not null references public.company_profile_versions(id) on delete restrict,
  snapshot_data jsonb not null check (jsonb_typeof(snapshot_data) = 'object'),
  created_at timestamptz not null default now(),
  unique (campaign_id),
  unique (workspace_id, id)
);

-- Source: supabase/baseline/004_campaigns.sql

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null check (external_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 180),
  objective text not null,
  selected_offering_id text,
  target_geography text not null default '',
  initial_target_description text not null default '',
  industries text[] not null default '{}',
  company_characteristics text[] not null default '{}',
  relevant_use_case text not null default '',
  exclusions text[] not null default '{}',
  target_volume integer not null default 25 check (target_volume > 0),
  budget_limit numeric(14, 4) check (budget_limit is null or budget_limit >= 0),
  budget_currency text not null default 'EUR' check (char_length(budget_currency) = 3),
  preferred_outreach_language text not null default 'English',
  outreach_enabled boolean not null default false,
  approval_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(approval_settings) = 'object'),
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  profile_snapshot_id uuid,
  current_strategy_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id),
  unique (workspace_id, id)
);

alter table public.campaign_profile_snapshots
  add constraint campaign_profile_snapshots_campaign_fk
  foreign key (campaign_id) references public.campaigns(id) on delete cascade;

alter table public.campaigns
  add constraint campaigns_profile_snapshot_fk
  foreign key (profile_snapshot_id) references public.campaign_profile_snapshots(id) on delete restrict;

create table public.campaign_strategy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'used', 'superseded')),
  strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(strategy) = 'object'),
  prompt_version text,
  model_config_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id, version),
  unique (workspace_id, id)
);

alter table public.campaigns
  add constraint campaigns_current_strategy_fk
  foreign key (current_strategy_version_id) references public.campaign_strategy_versions(id) on delete restrict;

-- Source: supabase/baseline/005_campaign_execution.sql

create table public.campaign_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  profile_snapshot_id uuid not null references public.campaign_profile_snapshots(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'queued', 'planning', 'waiting_for_input', 'discovering', 'evaluating',
    'qualifying', 'waiting_for_enrichment_approval', 'enriching',
    'preparing_outreach', 'waiting_for_outreach_approval', 'scheduled', 'completed',
    'partially_completed', 'failed', 'cancelled'
  )),
  current_phase text not null default 'draft',
  current_iteration integer not null default 0 check (current_iteration >= 0),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  companies_discovered integer not null default 0 check (companies_discovered >= 0),
  companies_qualified integer not null default 0 check (companies_qualified >= 0),
  contacts_found integer not null default 0 check (contacts_found >= 0),
  llm_cost numeric(14, 6) not null default 0 check (llm_cost >= 0),
  provider_cost numeric(14, 6) not null default 0 check (provider_cost >= 0),
  total_cost numeric(14, 6) generated always as (llm_cost + provider_cost) stored,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  trigger_run_id text unique,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.campaign_run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  event_type text not null,
  phase text,
  level text not null default 'info' check (level in ('debug', 'info', 'warning', 'error')),
  summary text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  visible_to_user boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.campaign_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  question_type text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed', 'expired')),
  answer jsonb,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  approval_type text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  requested_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(requested_payload) = 'object'),
  decision_notes text,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  unique (campaign_run_id, approval_type, status)
);

-- Source: supabase/baseline/006_companies.sql

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  website_url text,
  country text,
  city text,
  industry text,
  company_type text,
  estimated_size text,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.company_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  domain text not null,
  normalized_domain text not null,
  is_primary boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'source_confirmed', 'verified', 'disputed')),
  collision_status text not null default 'clear' check (collision_status in ('clear', 'ambiguous', 'manual_review', 'resolved')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, normalized_domain)
);

create table public.company_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider text not null,
  source_type text not null,
  query text,
  title text not null default '',
  source_url text not null,
  original_url text not null,
  retrieved_at timestamptz not null default now(),
  excerpt text not null default '',
  raw_content text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (workspace_id, provider, source_url)
);

create table public.campaign_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'discovered' check (status in ('discovered', 'researching', 'needs_review', 'approved', 'rejected', 'excluded', 'draft_ready', 'archived')),
  discovery_rank integer,
  source_summary text not null default '',
  user_notes text not null default '',
  first_discovered_at timestamptz not null default now(),
  last_evaluated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (campaign_id, company_id),
  unique (workspace_id, id)
);

-- Source: supabase/baseline/007_qualification.sql

create table public.qualification_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  status text not null check (status in ('highly_relevant', 'qualified', 'possible', 'insufficient_evidence', 'not_relevant', 'excluded')),
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  summary text not null,
  relationship_hypothesis text not null default '',
  recommended_roles text[] not null default '{}',
  positive_signals text[] not null default '{}',
  negative_signals text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  schema_version text not null,
  prompt_version text not null,
  model_config_id uuid,
  input_hash text not null,
  created_at timestamptz not null default now(),
  unique (campaign_company_id, input_hash)
);

create table public.qualification_dimensions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  qualification_result_id uuid not null references public.qualification_results(id) on delete cascade,
  criterion text not null,
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  explanation text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (qualification_result_id, criterion)
);

create table public.qualification_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  qualification_result_id uuid not null references public.qualification_results(id) on delete cascade,
  criterion text not null,
  evidence_kind text not null check (evidence_kind in ('fact', 'inference', 'unknown', 'conflict')),
  statement text not null,
  source_url text,
  source_id uuid references public.company_sources(id) on delete set null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

-- Source: supabase/baseline/008_contacts.sql

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

-- Source: supabase/baseline/009_outreach.sql

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  step_type text not null check (step_type in ('email_draft', 'manual_task')),
  delay_hours integer not null default 0 check (delay_hours >= 0),
  template jsonb not null default '{}'::jsonb check (jsonb_typeof(template) = 'object'),
  unique (sequence_id, step_number)
);

create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  campaign_contact_id uuid references public.campaign_contacts(id) on delete set null,
  sequence_step_id uuid references public.sequence_steps(id) on delete set null,
  profile_snapshot_id uuid not null references public.campaign_profile_snapshots(id) on delete restrict,
  strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  subject text not null,
  body text not null,
  variant text not null check (variant in ('primary', 'short', 'follow_up')),
  language text not null default 'English',
  status text not null default 'needs_review' check (status in ('needs_review', 'approved', 'edited', 'rejected')),
  seller_claims text[] not null default '{}',
  evidence_used uuid[] not null default '{}',
  warnings text[] not null default '{}',
  prompt_version text,
  model_config_id uuid,
  input_hash text not null,
  generated_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_company_id, campaign_contact_id, variant, input_hash)
);

create table public.export_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  export_type text not null check (export_type in ('outreach_csv', 'company_research_csv')),
  file_name text not null,
  row_count integer not null check (row_count >= 0),
  payload jsonb not null default '[]'::jsonb check (jsonb_typeof(payload) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Source: supabase/baseline/010_documents_and_memory.sql

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  storage_bucket text not null default 'workspace-documents',
  storage_path text not null,
  file_name text not null,
  media_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed', 'deleted')),
  checksum text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, storage_path)
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  page_number integer,
  section text,
  embedding extensions.vector(1536),
  embedding_model text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table public.campaign_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  scope text not null,
  category text not null,
  statement text not null,
  evidence_ids uuid[] not null default '{}',
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  approval_status text not null default 'proposed' check (approval_status in ('proposed', 'approved', 'rejected')),
  origin text not null,
  retention_class text not null default 'campaign',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.workspace_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category text not null,
  statement text not null,
  evidence_ids uuid[] not null default '{}',
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  approval_status text not null default 'proposed' check (approval_status in ('proposed', 'approved', 'rejected')),
  origin text not null,
  retention_class text not null default 'workspace',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

insert into storage.buckets (id, name, public)
values ('workspace-documents', 'workspace-documents', false)
on conflict (id) do update set public = false;

-- Source: supabase/baseline/011_ai_models_usage_costs.sql

create table public.ai_model_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  role text not null check (role in ('campaign_planning', 'profile_analysis', 'company_qualification', 'outreach_generation', 'website_extraction', 'search_result_classification', 'guided_interpretation', 'reflection', 'embedding')),
  gateway text not null default 'openrouter',
  provider text not null,
  model_id text not null,
  fallback_model_id text,
  temperature numeric(4, 3) check (temperature is null or temperature between 0 and 2),
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens > 0),
  timeout_ms integer not null default 120000 check (timeout_ms >= 5000),
  cost_limit numeric(14, 6) check (cost_limit is null or cost_limit >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (workspace_id, role)
);

create table public.operation_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'cancelled')),
  result_reference_type text,
  result_reference_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, operation, idempotency_key)
);

create table public.provider_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider text not null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  provider_reference text,
  input_units bigint,
  output_units bigint,
  estimated_cost numeric(14, 6) not null default 0 check (estimated_cost >= 0),
  actual_cost numeric(14, 6) not null default 0 check (actual_cost >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  provider_cost numeric(14, 6),
  provider_currency text check (provider_currency is null or char_length(provider_currency) = 3),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, operation, idempotency_key, attempt)
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider_execution_id uuid references public.provider_executions(id) on delete set null,
  model_config_id uuid references public.ai_model_configs(id) on delete restrict,
  role text not null,
  provider text not null,
  selected_model text not null,
  fallback_model text,
  fallback_used boolean not null default false,
  prompt_version text not null,
  schema_version text,
  request_hash text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_units bigint,
  output_units bigint,
  estimated_cost numeric(14, 6) not null default 0,
  actual_cost numeric(14, 6) not null default 0,
  currency text not null default 'EUR',
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider_execution_id uuid references public.provider_executions(id) on delete set null,
  operation text not null,
  entry_type text not null check (entry_type in ('estimate', 'reservation', 'settlement', 'adjustment', 'release')),
  idempotency_key text not null,
  credits numeric(14, 4) not null default 0,
  amount numeric(14, 6) not null default 0,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, entry_type, idempotency_key)
);

create table public.budget_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'expired')),
  reserved_amount numeric(14, 6) not null check (reserved_amount >= 0),
  settled_amount numeric(14, 6) check (settled_amount is null or settled_amount >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (workspace_id, operation, idempotency_key)
);

insert into public.ai_model_configs (role, gateway, provider, model_id, fallback_model_id)
values
  ('campaign_planning', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('profile_analysis', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('company_qualification', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('outreach_generation', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('website_extraction', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('search_result_classification', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('guided_interpretation', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('reflection', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('embedding', 'openrouter', 'openai', 'openai/text-embedding-3-small', null);

-- Source: supabase/baseline/012_guided_ai.sql

create table public.ai_guided_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('company_profile', 'campaign')),
  entity_id uuid,
  base_version integer not null check (base_version > 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'applied', 'discarded', 'stale')),
  proposal jsonb not null default '{}'::jsonb check (jsonb_typeof(proposal) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('company_profile', 'campaign')),
  entity_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.ai_applied_changes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  guided_draft_id uuid references public.ai_guided_drafts(id) on delete set null,
  scope text not null,
  entity_id uuid,
  source_version integer not null,
  target_version integer not null,
  changes jsonb not null check (jsonb_typeof(changes) = 'array'),
  undo_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(undo_metadata) = 'object'),
  applied_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Source: supabase/baseline/013_functions_and_triggers.sql

alter table public.company_profile_versions
  add constraint company_profile_versions_model_config_fk
  foreign key (analysis_model_config_id) references public.ai_model_configs(id) on delete set null;

alter table public.campaign_strategy_versions
  add constraint campaign_strategy_versions_model_config_fk
  foreign key (model_config_id) references public.ai_model_configs(id) on delete set null;

alter table public.qualification_results
  add constraint qualification_results_model_config_fk
  foreign key (model_config_id) references public.ai_model_configs(id) on delete set null;

alter table public.outreach_drafts
  add constraint outreach_drafts_model_config_fk
  foreign key (model_config_id) references public.ai_model_configs(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'owner'
  );
$$;

create or replace function public.current_workspace_role(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.slugify_workspace_name(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(trim(input)), '[^a-z0-9]+', '-', 'g'));
$$;

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

create or replace function public.create_initial_company_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_profiles (workspace_id) values (new.id);
  return new;
end;
$$;

create or replace function public.create_clean_campaign_run(
  target_workspace_id uuid,
  target_campaign_external_id text,
  desired_company_count integer
)
returns public.campaign_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign public.campaigns;
  created_run public.campaign_runs;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into target_campaign
  from public.campaigns
  where workspace_id = target_workspace_id
    and external_id = target_campaign_external_id
  for update;

  if target_campaign.id is null then raise exception 'Campaign not found'; end if;
  if target_campaign.current_strategy_version_id is null then
    raise exception 'Campaign Strategy is required';
  end if;
  if target_campaign.profile_snapshot_id is null then
    raise exception 'Campaign Profile snapshot is required';
  end if;

  insert into public.campaign_runs (
    workspace_id, campaign_id, strategy_version_id, profile_snapshot_id,
    status, current_phase, progress_percentage, metadata
  ) values (
    target_workspace_id, target_campaign.id,
    target_campaign.current_strategy_version_id, target_campaign.profile_snapshot_id,
    'queued', 'discovery_queued', 0,
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  )
  returning * into created_run;

  update public.campaign_strategy_versions
  set status = 'used'
  where id = target_campaign.current_strategy_version_id
    and status in ('draft', 'ready');

  insert into public.campaign_run_events (
    workspace_id, campaign_run_id, event_type, phase, summary, details
  ) values (
    target_workspace_id, created_run.id, 'campaign_run_queued', 'discovery_queued',
    'Campaign discovery was queued.',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  );

  return created_run;
end;
$$;

create or replace function public.assert_campaign_run_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  strategy_campaign uuid;
  strategy_workspace uuid;
  snapshot_campaign uuid;
  snapshot_workspace uuid;
begin
  select campaign_id, workspace_id into strategy_campaign, strategy_workspace
  from public.campaign_strategy_versions where id = new.strategy_version_id;
  select campaign_id, workspace_id into snapshot_campaign, snapshot_workspace
  from public.campaign_profile_snapshots where id = new.profile_snapshot_id;

  if strategy_campaign is distinct from new.campaign_id
     or snapshot_campaign is distinct from new.campaign_id
     or strategy_workspace is distinct from new.workspace_id
     or snapshot_workspace is distinct from new.workspace_id then
    raise exception 'Campaign run context must belong to the same campaign and workspace';
  end if;
  return new;
end;
$$;

create or replace function public.assert_workspace_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'company_profile_versions' then
    if not exists (
      select 1 from public.company_profiles p
      where p.id = new.company_profile_id and p.workspace_id = new.workspace_id
    ) then
      raise exception 'Cross-workspace company profile version';
    end if;
    return new;
  end if;

  if tg_table_name = 'campaign_strategy_versions' then
    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id and c.workspace_id = new.workspace_id
    ) then
      raise exception 'Cross-workspace campaign strategy';
    end if;
    return new;
  end if;

  if tg_table_name = 'campaign_companies' then
    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id and c.workspace_id = new.workspace_id
    ) or not exists (
      select 1 from public.companies c
      where c.id = new.company_id and c.workspace_id = new.workspace_id
    ) then
      raise exception 'Cross-workspace campaign company';
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create trigger workspaces_create_initial_company_profile
after insert on public.workspaces
for each row execute function public.create_initial_company_profile();

create trigger campaign_runs_assert_context
before insert or update of workspace_id, campaign_id, strategy_version_id, profile_snapshot_id
on public.campaign_runs
for each row execute function public.assert_campaign_run_context();

create trigger company_profile_versions_assert_workspace
before insert or update of workspace_id, company_profile_id on public.company_profile_versions
for each row execute function public.assert_workspace_consistency();

create trigger campaign_strategy_versions_assert_workspace
before insert or update of workspace_id, campaign_id on public.campaign_strategy_versions
for each row execute function public.assert_workspace_consistency();

create trigger campaign_companies_assert_workspace
before insert or update of workspace_id, campaign_id, company_id on public.campaign_companies
for each row execute function public.assert_workspace_consistency();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'workspaces', 'workspace_members', 'company_profiles', 'campaigns',
    'campaign_runs', 'companies', 'contacts', 'sequences', 'outreach_drafts',
    'documents', 'ai_model_configs', 'ai_guided_drafts', 'ai_conversations'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.is_workspace_owner(uuid) from public, anon;
revoke all on function public.current_workspace_role(uuid) from public, anon;
revoke all on function public.create_workspace(text, text) from public, anon;
revoke all on function public.create_clean_campaign_run(uuid, text, integer) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function public.current_workspace_role(uuid) to authenticated, service_role;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.create_clean_campaign_run(uuid, text, integer) to authenticated;

-- Source: supabase/baseline/014_rls.sql

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'workspaces', 'workspace_members', 'activity_events',
    'company_profiles', 'company_profile_versions', 'campaign_profile_snapshots',
    'campaigns', 'campaign_strategy_versions', 'campaign_runs', 'campaign_run_events',
    'campaign_questions', 'campaign_approvals', 'companies', 'company_domains',
    'company_sources', 'campaign_companies', 'qualification_results',
    'qualification_dimensions', 'qualification_evidence', 'contacts', 'contact_methods',
    'contact_sources', 'campaign_contacts', 'contact_enrichments', 'email_verifications',
    'sequences', 'sequence_steps', 'outreach_drafts', 'export_records', 'documents',
    'document_chunks', 'campaign_memories', 'workspace_memories', 'ai_model_configs',
    'operation_idempotency_keys', 'provider_executions', 'ai_requests', 'usage_ledger',
    'budget_reservations', 'ai_guided_drafts', 'ai_conversations', 'ai_messages',
    'ai_applied_changes'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy "Users can read own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "Users can update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read workspaces" on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy "Admins can update workspaces" on public.workspaces
for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy "Members can read workspace members" on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Owners can manage workspace members" on public.workspace_members
for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'activity_events', 'company_profiles', 'company_profile_versions',
    'campaign_profile_snapshots', 'campaigns', 'campaign_strategy_versions',
    'campaign_runs', 'campaign_run_events', 'campaign_questions', 'campaign_approvals',
    'companies', 'company_domains', 'company_sources', 'campaign_companies',
    'qualification_results', 'qualification_dimensions', 'qualification_evidence',
    'contacts', 'contact_methods', 'contact_sources', 'campaign_contacts',
    'contact_enrichments', 'email_verifications', 'sequences', 'sequence_steps',
    'outreach_drafts', 'export_records', 'documents', 'document_chunks',
    'campaign_memories', 'workspace_memories', 'operation_idempotency_keys',
    'provider_executions', 'ai_requests', 'usage_ledger', 'budget_reservations',
    'ai_guided_drafts', 'ai_conversations', 'ai_messages', 'ai_applied_changes'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))',
      'Admins can manage ' || table_name,
      table_name
    );
  end loop;
end;
$$;

create policy "Authenticated users can read global model configs" on public.ai_model_configs
for select to authenticated using (
  workspace_id is null or public.is_workspace_member(workspace_id)
);
create policy "Workspace admins can manage model overrides" on public.ai_model_configs
for all to authenticated using (
  workspace_id is not null and public.is_workspace_admin(workspace_id)
) with check (
  workspace_id is not null and public.is_workspace_admin(workspace_id)
);

create policy "Members can read private workspace documents" on storage.objects
for select to authenticated using (
  bucket_id = 'workspace-documents'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
create policy "Admins can upload private workspace documents" on storage.objects
for insert to authenticated with check (
  bucket_id = 'workspace-documents'
  and public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
);
create policy "Admins can update private workspace documents" on storage.objects
for update to authenticated using (
  bucket_id = 'workspace-documents'
  and public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id = 'workspace-documents'
  and public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
);
create policy "Admins can delete private workspace documents" on storage.objects
for delete to authenticated using (
  bucket_id = 'workspace-documents'
  and public.is_workspace_admin(((storage.foldername(name))[1])::uuid)
);

-- Source: supabase/baseline/015_indexes.sql

create index workspace_members_user_idx on public.workspace_members(user_id, status);
create index activity_events_workspace_created_idx on public.activity_events(workspace_id, created_at desc);
create index company_profile_versions_profile_idx on public.company_profile_versions(company_profile_id, version desc);
create index campaigns_workspace_status_idx on public.campaigns(workspace_id, status);
create index campaign_strategy_versions_campaign_idx on public.campaign_strategy_versions(campaign_id, version desc);
create index campaign_runs_campaign_created_idx on public.campaign_runs(campaign_id, created_at desc);
create index campaign_runs_workspace_status_idx on public.campaign_runs(workspace_id, status, created_at desc);
create index campaign_run_events_run_created_idx on public.campaign_run_events(campaign_run_id, created_at);
create index campaign_questions_open_idx on public.campaign_questions(campaign_run_id, status) where status = 'open';
create index campaign_approvals_pending_idx on public.campaign_approvals(campaign_run_id, status) where status = 'pending';
create index companies_workspace_name_idx on public.companies(workspace_id, normalized_name);
create index company_domains_company_idx on public.company_domains(company_id);
create index company_sources_company_idx on public.company_sources(company_id, retrieved_at desc);
create index campaign_companies_campaign_status_idx on public.campaign_companies(campaign_id, status);
create index campaign_companies_company_idx on public.campaign_companies(company_id);
create index qualification_results_campaign_company_idx on public.qualification_results(campaign_company_id, created_at desc);
create index qualification_evidence_result_idx on public.qualification_evidence(qualification_result_id);
create index contacts_company_idx on public.contacts(company_id);
create index contact_methods_company_idx on public.contact_methods(company_id, method_type);
create index campaign_contacts_company_idx on public.campaign_contacts(campaign_company_id, selection_status);
create index outreach_drafts_campaign_idx on public.outreach_drafts(campaign_id, status, created_at desc);
create index export_records_campaign_idx on public.export_records(campaign_id, created_at desc);
create index documents_workspace_status_idx on public.documents(workspace_id, status);
create index document_chunks_document_idx on public.document_chunks(document_id, chunk_index);
create index campaign_memories_campaign_idx on public.campaign_memories(campaign_id, category);
create index workspace_memories_workspace_idx on public.workspace_memories(workspace_id, category);
create index provider_executions_run_idx on public.provider_executions(campaign_run_id, created_at desc);
create index ai_requests_run_idx on public.ai_requests(campaign_run_id, created_at desc);
create index usage_ledger_workspace_created_idx on public.usage_ledger(workspace_id, created_at desc);
create index budget_reservations_run_status_idx on public.budget_reservations(campaign_run_id, status);
create index ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at);

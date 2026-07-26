alter table public.lead_contact_routes
  add column verification_provider text,
  add column verification_query text,
  add column verification_source_title text,
  add column verification_source_url text,
  add column verified_at timestamptz;

comment on column public.lead_contact_routes.verification_provider is
  'External provider that returned the evidence used to confirm this route.';
comment on column public.lead_contact_routes.verification_query is
  'Provider query used to obtain the confirming evidence.';
comment on column public.lead_contact_routes.verification_source_url is
  'Public source URL containing the confirmed route.';

alter table public.campaigns
add column if not exists desired_lead_count int not null default 25 check (desired_lead_count >= 1),
add column if not exists latest_discovery_report jsonb;

update public.campaigns
set desired_lead_count = greatest(lead_count, 1)
where lead_count > 0;

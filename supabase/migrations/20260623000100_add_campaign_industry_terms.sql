alter table public.campaigns
add column industry_terms text[] not null default '{}';

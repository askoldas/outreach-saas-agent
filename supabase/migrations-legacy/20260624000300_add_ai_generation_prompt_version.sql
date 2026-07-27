alter table public.ai_generations
add column if not exists prompt_version text not null default 'unversioned';

create index if not exists ai_generations_prompt_version_idx
on public.ai_generations(workspace_id, task_name, prompt_version, created_at desc);

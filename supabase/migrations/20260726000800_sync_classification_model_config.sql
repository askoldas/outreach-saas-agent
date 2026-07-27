update public.ai_model_configs
set
  provider = 'openai',
  model_id = 'openai/gpt-5-mini',
  fallback_model_id = null,
  updated_at = now()
where workspace_id is null
  and role = 'search_result_classification';

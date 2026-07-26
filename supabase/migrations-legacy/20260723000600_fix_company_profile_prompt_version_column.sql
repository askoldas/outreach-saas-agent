do $$
declare
  function_signature regprocedure := to_regprocedure(
    'public.save_analyzed_company_profile_version_v2(uuid,uuid,jsonb,jsonb,jsonb,text)'
  );
  function_definition text;
begin
  if function_signature is null then
    raise exception 'save_analyzed_company_profile_version_v2 is not installed';
  end if;

  select pg_get_functiondef(function_signature) into function_definition;

  if position('analysis_prompt_version' in function_definition) > 0 then
    execute replace(function_definition, 'analysis_prompt_version', 'prompt_version');
  end if;
end;
$$;

revoke all on function public.save_analyzed_company_profile_version_v2(
  uuid, uuid, jsonb, jsonb, jsonb, text
) from public;
revoke all on function public.save_analyzed_company_profile_version_v2(
  uuid, uuid, jsonb, jsonb, jsonb, text
) from anon;
revoke all on function public.save_analyzed_company_profile_version_v2(
  uuid, uuid, jsonb, jsonb, jsonb, text
) from authenticated;
grant execute on function public.save_analyzed_company_profile_version_v2(
  uuid, uuid, jsonb, jsonb, jsonb, text
) to service_role;

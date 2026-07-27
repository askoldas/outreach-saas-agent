do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.save_structured_company_profile_version(uuid,jsonb,jsonb,jsonb)'::regprocedure
  );
  function_definition := replace(function_definition,
    'select distinct value from jsonb_array_elements(coalesce(profile_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''targetCustomerTypes'', ''[]'')) value',
    'select distinct customer_type.value from jsonb_array_elements(coalesce(profile_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''targetCustomerTypes'', ''[]'')) as customer_type(value)');
  function_definition := replace(function_definition,
    'select value from jsonb_array_elements_text(coalesce(profile_data->''operatingMarkets'', ''[]'')) value',
    'select market.value from jsonb_array_elements_text(coalesce(profile_data->''operatingMarkets'', ''[]'')) as market(value)');
  function_definition := replace(function_definition,
    'select value from jsonb_array_elements_text(coalesce(profile_data->''supportedLanguages'', ''[]'')) value',
    'select language.value from jsonb_array_elements_text(coalesce(profile_data->''supportedLanguages'', ''[]'')) as language(value)');
  function_definition := replace(function_definition,
    'select value from jsonb_array_elements_text(coalesce(profile_data#>''{communicationRules,approvedClaims}'', ''[]'')) value',
    'select claim.value from jsonb_array_elements_text(coalesce(profile_data#>''{communicationRules,approvedClaims}'', ''[]'')) as claim(value)');
  function_definition := replace(function_definition,
    'select distinct value from jsonb_array_elements(coalesce(profile_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''commercialConstraints'', ''[]'')) value',
    'select distinct constraint_item.value from jsonb_array_elements(coalesce(profile_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''commercialConstraints'', ''[]'')) as constraint_item(value)');
  if position('customer_type.value' in function_definition) = 0
    or position('constraint_item.value' in function_definition) = 0 then
    raise exception 'Could not replace structured profile JSON projections';
  end if;
  execute function_definition;

  function_definition := pg_get_functiondef(
    'public.save_analyzed_company_profile_version(uuid,uuid,jsonb,text)'::regprocedure
  );
  function_definition := replace(function_definition,
    'select distinct value from jsonb_array_elements(coalesce(structured_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''targetCustomerTypes'', ''[]'')) value',
    'select distinct customer_type.value from jsonb_array_elements(coalesce(structured_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''targetCustomerTypes'', ''[]'')) as customer_type(value)');
  function_definition := replace(function_definition,
    'select value from jsonb_array_elements_text(coalesce(structured_data->''operatingMarkets'', ''[]'')) value',
    'select market.value from jsonb_array_elements_text(coalesce(structured_data->''operatingMarkets'', ''[]'')) as market(value)');
  function_definition := replace(function_definition,
    'select value from jsonb_array_elements_text(coalesce(structured_data->''supportedLanguages'', ''[]'')) value',
    'select language.value from jsonb_array_elements_text(coalesce(structured_data->''supportedLanguages'', ''[]'')) as language(value)');
  function_definition := replace(function_definition,
    'select value from jsonb_array_elements_text(coalesce(structured_data#>''{communicationRules,approvedClaims}'', ''[]'')) value',
    'select claim.value from jsonb_array_elements_text(coalesce(structured_data#>''{communicationRules,approvedClaims}'', ''[]'')) as claim(value)');
  function_definition := replace(function_definition,
    'select distinct value from jsonb_array_elements(coalesce(structured_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''commercialConstraints'', ''[]'')) value',
    'select distinct constraint_item.value from jsonb_array_elements(coalesce(structured_data->''offerings'', ''[]'')) item cross join lateral jsonb_array_elements_text(coalesce(item->''commercialConstraints'', ''[]'')) as constraint_item(value)');
  if position('customer_type.value' in function_definition) = 0
    or position('constraint_item.value' in function_definition) = 0 then
    raise exception 'Could not replace analyzed profile JSON projections';
  end if;
  execute function_definition;
end;
$$;

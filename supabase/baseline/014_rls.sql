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


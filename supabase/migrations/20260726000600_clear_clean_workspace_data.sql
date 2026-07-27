create or replace function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.workspaces where id = target_workspace_id for update
  ) then
    raise exception 'Workspace not found';
  end if;

  -- Break the two intentional current-version cycles before deleting their graphs.
  update public.campaigns
  set profile_snapshot_id = null, current_strategy_version_id = null
  where workspace_id = target_workspace_id;

  update public.company_profiles
  set current_version_id = null
  where workspace_id = target_workspace_id;

  -- Guided AI state.
  delete from public.ai_applied_changes where workspace_id = target_workspace_id;
  delete from public.ai_messages where workspace_id = target_workspace_id;
  delete from public.ai_conversations where workspace_id = target_workspace_id;
  delete from public.ai_guided_drafts where workspace_id = target_workspace_id;

  -- Usage, execution, and workspace-specific model state.
  delete from public.budget_reservations where workspace_id = target_workspace_id;
  delete from public.usage_ledger where workspace_id = target_workspace_id;
  delete from public.ai_requests where workspace_id = target_workspace_id;
  delete from public.provider_executions where workspace_id = target_workspace_id;
  delete from public.operation_idempotency_keys where workspace_id = target_workspace_id;
  delete from public.ai_model_configs where workspace_id = target_workspace_id;

  -- Documents and memory. Storage objects are deleted through the Storage API
  -- before this transaction; these deletes remove the database records.
  delete from public.document_chunks where workspace_id = target_workspace_id;
  delete from public.documents where workspace_id = target_workspace_id;
  delete from public.campaign_memories where workspace_id = target_workspace_id;
  delete from public.workspace_memories where workspace_id = target_workspace_id;

  -- Outreach and contact state.
  delete from public.export_records where workspace_id = target_workspace_id;
  delete from public.outreach_drafts where workspace_id = target_workspace_id;
  delete from public.sequence_steps where workspace_id = target_workspace_id;
  delete from public.sequences where workspace_id = target_workspace_id;
  delete from public.email_verifications where workspace_id = target_workspace_id;
  delete from public.campaign_contacts where workspace_id = target_workspace_id;
  delete from public.contact_sources where workspace_id = target_workspace_id;
  delete from public.contact_enrichments where workspace_id = target_workspace_id;
  delete from public.contact_methods where workspace_id = target_workspace_id;
  delete from public.contacts where workspace_id = target_workspace_id;

  -- Qualification and reusable company research.
  delete from public.qualification_evidence where workspace_id = target_workspace_id;
  delete from public.qualification_dimensions where workspace_id = target_workspace_id;
  delete from public.qualification_results where workspace_id = target_workspace_id;
  delete from public.campaign_companies where workspace_id = target_workspace_id;
  delete from public.company_sources where workspace_id = target_workspace_id;
  delete from public.company_domains where workspace_id = target_workspace_id;

  -- Campaign execution and configuration.
  delete from public.campaign_agent_checkpoints where workspace_id = target_workspace_id;
  delete from public.campaign_approvals where workspace_id = target_workspace_id;
  delete from public.campaign_questions where workspace_id = target_workspace_id;
  delete from public.campaign_run_events where workspace_id = target_workspace_id;
  delete from public.campaign_runs where workspace_id = target_workspace_id;
  delete from public.campaign_strategy_versions where workspace_id = target_workspace_id;
  delete from public.campaign_profile_snapshots where workspace_id = target_workspace_id;
  delete from public.campaigns where workspace_id = target_workspace_id;

  delete from public.companies where workspace_id = target_workspace_id;

  -- Delete Company Profile last and deliberately do not recreate an empty profile.
  delete from public.company_profile_versions where workspace_id = target_workspace_id;
  delete from public.company_profiles where workspace_id = target_workspace_id;

  delete from public.activity_events where workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public;
revoke all on function public.clear_workspace_data(uuid) from anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;

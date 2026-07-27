import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import {
  parseWorkspaceIntelligenceSettings,
  resolveWorkspaceIntelligenceSettings,
  type WorkspaceIntelligenceSettings,
} from "@/lib/intelligence/rollout";

type WorkspaceIntelligenceSettingsRow = {
  campaign_workflow: string;
  enabled_providers: string[];
  profile_version: string;
  result_write_mode: string;
  shadow_mode: boolean;
};

export async function getWorkspaceIntelligenceSettings(
  workspaceId: string,
): Promise<WorkspaceIntelligenceSettings> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("workspace_intelligence_settings")
    .select(
      "profile_version,campaign_workflow,shadow_mode,enabled_providers,result_write_mode",
    )
    .eq("workspace_id", workspaceId)
    .single();
  if (error)
    throw new Error(`Could not load workspace Intelligence settings: ${error.message}`);
  return resolveWorkspaceIntelligenceSettings({
    settings: mapSettings(data as WorkspaceIntelligenceSettingsRow),
  });
}

export async function updateWorkspaceIntelligenceSettings(
  workspaceId: string,
  requested: WorkspaceIntelligenceSettings,
): Promise<WorkspaceIntelligenceSettings> {
  const settings = resolveWorkspaceIntelligenceSettings({
    settings: parseWorkspaceIntelligenceSettings(requested),
  });
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("workspace_intelligence_settings")
    .update({
      campaign_workflow: settings.campaignWorkflow,
      enabled_providers: settings.enabledProviders,
      profile_version: settings.profileVersion,
      result_write_mode: settings.resultWriteMode,
      shadow_mode: settings.shadowMode,
      updated_by: user.id,
    })
    .eq("workspace_id", workspaceId)
    .select(
      "profile_version,campaign_workflow,shadow_mode,enabled_providers,result_write_mode",
    )
    .single();
  if (error)
    throw new Error(`Could not update workspace Intelligence settings: ${error.message}`);
  return mapSettings(data as WorkspaceIntelligenceSettingsRow);
}

function mapSettings(
  row: WorkspaceIntelligenceSettingsRow,
): WorkspaceIntelligenceSettings {
  return parseWorkspaceIntelligenceSettings({
    campaignWorkflow:
      row.campaign_workflow as WorkspaceIntelligenceSettings["campaignWorkflow"],
    enabledProviders: row.enabled_providers,
    profileVersion:
      row.profile_version as WorkspaceIntelligenceSettings["profileVersion"],
    resultWriteMode:
      row.result_write_mode as WorkspaceIntelligenceSettings["resultWriteMode"],
    shadowMode: row.shadow_mode,
  });
}

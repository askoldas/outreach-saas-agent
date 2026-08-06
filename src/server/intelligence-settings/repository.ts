import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  defaultWorkspaceIntelligenceSettings,
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

const settingsSelection =
  "profile_version,campaign_workflow,shadow_mode,enabled_providers,result_write_mode";

export async function getWorkspaceIntelligenceSettings(
  workspaceId: string,
): Promise<WorkspaceIntelligenceSettings> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("workspace_intelligence_settings")
    .select(settingsSelection)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `Could not load workspace Intelligence settings: ${error.message}. Apply migration 20260728000100_intelligence_v2_versioning_and_rollout.sql if this table is missing.`,
    );
  }
  if (data) {
    return resolveWorkspaceIntelligenceSettings({
      settings: mapSettings(data as WorkspaceIntelligenceSettingsRow),
    });
  }

  await assertWorkspaceAccessible(supabase, workspaceId);
  const service = createServiceRoleClient();
  const defaults = defaultWorkspaceIntelligenceSettings;
  const { data: repaired, error: repairError } = await service
    .from("workspace_intelligence_settings")
    .upsert(
      {
        workspace_id: workspaceId,
        campaign_workflow: defaults.campaignWorkflow,
        enabled_providers: defaults.enabledProviders,
        profile_version: defaults.profileVersion,
        result_write_mode: defaults.resultWriteMode,
        shadow_mode: defaults.shadowMode,
      },
      { onConflict: "workspace_id" },
    )
    .select(settingsSelection)
    .single();
  if (repairError) {
    throw new Error(
      `Could not repair workspace Intelligence settings: ${repairError.message}`,
    );
  }
  return resolveWorkspaceIntelligenceSettings({
    settings: mapSettings(repaired as WorkspaceIntelligenceSettingsRow),
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
    .select(settingsSelection)
    .single();
  if (error)
    throw new Error(`Could not update workspace Intelligence settings: ${error.message}`);
  return mapSettings(data as WorkspaceIntelligenceSettingsRow);
}

async function assertWorkspaceAccessible(
  supabase: Awaited<ReturnType<typeof createAuthenticatedDatabaseClient>>["supabase"],
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Could not verify workspace access: ${error.message}`);
  if (!data) throw new Error("Workspace Intelligence settings are not accessible.");
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
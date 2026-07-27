import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { adaptV2ProfileToV3Draft } from "@/lib/intelligence/company-profile-v3";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import type { createCompanyIntelligenceV3Task } from "@/trigger/create-company-intelligence-v3";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";

export async function createAndDispatchCompanyIntelligenceV3Draft(workspaceId: string) {
  const settings = await getWorkspaceIntelligenceSettings(workspaceId);
  if (settings.profileVersion !== "v2")
    throw new Error("Company Intelligence V3 is not enabled for this workspace.");
  const current = await getCurrentCompanyProfile(workspaceId);
  if (!current.id || !current.structuredProfile)
    throw new Error("A structured Company Profile version is required.");

  const snapshot = adaptV2ProfileToV3Draft({
    workspaceId,
    profileVersionId: current.id,
    profile: current.structuredProfile,
  });
  const inputHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: draft, error } = await supabase.rpc("create_company_profile_v3_draft", {
    target_workspace_id: workspaceId,
    target_base_version_id: current.id,
    target_input_hash: inputHash,
    target_snapshot: snapshot as Json,
  });
  if (error)
    throw new Error(`Could not create Company Intelligence draft: ${error.message}`);

  const handle = await tasks.trigger<typeof createCompanyIntelligenceV3Task>(
    "create-company-intelligence-v3",
    { workspaceId, profileDraftId: draft.id },
    {
      idempotencyKey: `profile-v3:${draft.id}:${inputHash}:v1`,
      tags: [`workspace:${workspaceId}`, `profile_draft:${draft.id}`],
    },
  );
  const { error: linkError } = await supabase
    .from("company_profile_drafts")
    .update({
      created_by_run_id: handle.id,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", draft.id);
  if (linkError)
    throw new Error(`Could not link Company Intelligence run: ${linkError.message}`);
  return { profileDraftId: draft.id, triggerRunId: handle.id };
}

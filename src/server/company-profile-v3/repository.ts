import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { adaptV2ProfileToV3Draft } from "@/lib/intelligence/company-profile-v3";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";
import type { createCompanyIntelligenceV3Task } from "@/trigger/create-company-intelligence-v3";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";

type BusinessModelRow = Database["public"]["Tables"]["company_business_models"]["Row"];
type BusinessRoleRow = Database["public"]["Tables"]["company_business_roles"]["Row"];
type OfferingVersionRow =
  Database["public"]["Tables"]["company_offering_versions"]["Row"];
type ArchetypeRow = Database["public"]["Tables"]["buyer_archetype_hypotheses"]["Row"];
type RuleRow = Database["public"]["Tables"]["commercial_rules"]["Row"];
type QuestionRow = Database["public"]["Tables"]["profile_clarification_questions"]["Row"];

export type CompanyProfileV3Review = {
  id: string;
  state: string;
  contractVersion: string;
  updatedAt: string;
  triggerRunId: string | null;
  businessModel: BusinessModelRow | null;
  businessRoles: BusinessRoleRow[];
  offerings: Array<OfferingVersionRow & { archetypes: ArchetypeRow[] }>;
  rules: RuleRow[];
  questions: QuestionRow[];
  compiledSnapshot: Json;
};

export async function getCurrentCompanyProfileV3Review(
  workspaceId: string,
): Promise<CompanyProfileV3Review | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("current_v3_draft_id")
    .eq("workspace_id", workspaceId)
    .single();
  if (profileError)
    throw new Error(
      `Could not load Company Intelligence profile: ${profileError.message}`,
    );
  if (!profile.current_v3_draft_id) return null;

  const draftId = profile.current_v3_draft_id;
  const [
    { data: draft, error: draftError },
    { data: models, error: modelError },
    { data: offerings, error: offeringError },
    { data: archetypes, error: archetypeError },
    { data: rules, error: ruleError },
    { data: questions, error: questionError },
  ] = await Promise.all([
    supabase
      .from("company_profile_drafts")
      .select(
        "id,state,contract_version,updated_at,created_by_run_id,compiled_snapshot_json",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", draftId)
      .single(),
    supabase
      .from("company_business_models")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .limit(1),
    supabase
      .from("company_offering_versions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .order("name"),
    supabase
      .from("buyer_archetype_hypotheses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .order("name"),
    supabase
      .from("commercial_rules")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .order("rule_key"),
    supabase
      .from("profile_clarification_questions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .order("created_at"),
  ]);
  const error =
    draftError ??
    modelError ??
    offeringError ??
    archetypeError ??
    ruleError ??
    questionError;
  if (error)
    throw new Error(`Could not load Company Intelligence review: ${error.message}`);
  if (!draft) throw new Error("Could not load Company Intelligence review draft.");

  const businessModel = (models?.[0] as BusinessModelRow | undefined) ?? null;
  const businessRoles = businessModel
    ? await loadBusinessRoles(workspaceId, businessModel.id)
    : [];
  return {
    id: draft.id,
    state: draft.state,
    contractVersion: draft.contract_version,
    updatedAt: draft.updated_at,
    triggerRunId: draft.created_by_run_id,
    businessModel,
    businessRoles,
    offerings: (offerings ?? []).map((offering) => ({
      ...offering,
      archetypes: (archetypes ?? []).filter(
        (archetype) => archetype.offering_version_id === offering.id,
      ),
    })),
    rules: rules ?? [],
    questions: questions ?? [],
    compiledSnapshot: draft.compiled_snapshot_json,
  };
}

async function loadBusinessRoles(workspaceId: string, businessModelId: string) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("company_business_roles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("business_model_id", businessModelId)
    .order("priority");
  if (error)
    throw new Error(`Could not load Company Intelligence roles: ${error.message}`);
  return data ?? [];
}

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
      idempotencyKey: `profile-v3:${draft.id}:${inputHash}:v2`,
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

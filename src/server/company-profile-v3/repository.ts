import { createHash, randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { createNativeCompanyProfileSeed } from "@/lib/intelligence/company-profile-v3/native-source";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database.types";
import type { createCompanyIntelligenceV3Task } from "@/trigger/create-company-intelligence-v3";
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
  publicName: string;
  canonicalDomain: string;
  commercialSummary: string;
  relationships: Array<{
    id: string; organization_name: string; canonical_domain: string | null;
    relationship_type: string; status: string; confidence: number;
    evidence_ids: string[]; source: string; scope: string;
  }>;
  targetRoles: Array<{
    id: string; role_key: string; label: string; offering_keys: string[];
    archetype_keys: string[]; confidence: number; evidence_ids: string[]; origin: string;
  }>;
  diagnostics: { stages: Json[]; sourceCollections: Json[] };
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
    relationshipResult,
    targetRoleResult,
    { data: stageDiagnostics, error: stageDiagnosticsError },
    { data: sourceDiagnostics, error: sourceDiagnosticsError },
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
    (supabase as unknown as { from(table: string): { select(columns: string): { eq(column: string, value: string): PromiseLike<{ data: CompanyProfileV3Review["relationships"] | null; error: { message: string } | null }> } } })
      .from("organization_relationship_memories_v2").select("id,organization_name,canonical_domain,relationship_type,status,confidence,evidence_ids,source,scope").eq("workspace_id", workspaceId),
    (supabase as unknown as { from(table: string): { select(columns: string): { eq(column: string, value: string): PromiseLike<{ data: CompanyProfileV3Review["targetRoles"] | null; error: { message: string } | null }> } } })
      .from("company_target_roles_v2").select("id,role_key,label,offering_keys,archetype_keys,confidence,evidence_ids,origin").eq("profile_draft_id", draftId),
    supabase.from("profile_task_runs").select("task_id,status,attempt_count,started_at,completed_at,ai_request_ids").eq("workspace_id", workspaceId).eq("profile_draft_id", draftId).order("created_at"),
    supabase.from("provider_executions").select("operation,status,attempt,started_at,completed_at,metadata").eq("workspace_id", workspaceId).eq("operation", "company_profile_source_collection").contains("metadata", { profileDraftId: draftId }).order("started_at", { ascending: false }).limit(5),
  ]);
  const error =
    draftError ??
    modelError ??
    offeringError ??
    archetypeError ??
    ruleError ??
    questionError;
  const combinedError = error ?? relationshipResult.error ?? targetRoleResult.error ?? stageDiagnosticsError ?? sourceDiagnosticsError;
  if (combinedError)
    throw new Error(`Could not load Company Intelligence review: ${combinedError.message}`);
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
    publicName: nestedString(draft.compiled_snapshot_json, "identity", "publicName"),
    canonicalDomain: nestedString(
      draft.compiled_snapshot_json,
      "identity",
      "canonicalDomain",
    ),
    commercialSummary: nestedString(
      draft.compiled_snapshot_json,
      "commercialSynthesis",
      "conciseCommercialSummary",
    ),
    relationships: relationshipResult.data ?? [],
    targetRoles: targetRoleResult.data ?? [],
    diagnostics: {
      stages: (stageDiagnostics ?? []) as unknown as Json[],
      sourceCollections: (sourceDiagnostics ?? []) as unknown as Json[],
    },
  };
}

function nestedString(value: Json, parent: string, child: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const nested = value[parent];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return "";
  return typeof nested[child] === "string" ? nested[child] : "";
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

export async function createAndDispatchCompanyIntelligenceV3Draft(workspaceId: string, options: { forceRefresh?: boolean } = {}) {
  const settings = await getWorkspaceIntelligenceSettings(workspaceId);
  if (settings.profileVersion !== "v2")
    throw new Error("Company Intelligence V3 is not enabled for this workspace.");

  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id,name,website_url")
    .eq("id", workspaceId)
    .single();
  if (workspaceError)
    throw new Error(`Could not load Company workspace: ${workspaceError.message}`);
  if (!workspace.website_url)
    throw new Error("A company website is required for native Company Intelligence.");

  const profile = await ensureCompanyProfileContainer(workspaceId);
  const snapshot = createNativeCompanyProfileSeed({
    companyProfileId: profile.id,
    publicName: workspace.name,
    websiteUrl: workspace.website_url,
    workspaceId,
    forceRefresh: options.forceRefresh,
  });
  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        analysisRequestId: randomUUID(),
        contractVersion: "company-intelligence/v3.0",
        snapshot,
      }),
    )
    .digest("hex");
  const { data: draft, error } = await supabase.rpc(
    "create_native_company_profile_v3_draft",
    {
      target_workspace_id: workspaceId,
      target_input_hash: inputHash,
      target_snapshot: snapshot as Json,
    },
  );
  if (error)
    throw new Error(
      `Could not create Company Intelligence draft: ${error.message}. Apply migration 20260729000200_native_company_intelligence_v3_entry.sql if the RPC is missing.`,
    );

  let handle;
  try {
    handle = await tasks.trigger<typeof createCompanyIntelligenceV3Task>(
      "create-company-intelligence-v3",
      { workspaceId, profileDraftId: draft.id },
      {
        idempotencyKey: `profile-v3:${draft.id}:${inputHash}:native-v3`,
        tags: [`workspace:${workspaceId}`, `profile_draft:${draft.id}`],
      },
    );
  } catch (dispatchError) {
    if (isIndeterminateTriggerDispatchError(dispatchError)) {
      // Trigger.dev may accept the idempotent run before the client-side request times
      // out. The task links its own run ID on start, so keep the durable draft alive.
      return {
        profileDraftId: draft.id,
        triggerRunId: null,
        dispatchPending: true as const,
      };
    }
    await supabase
      .from("company_profile_drafts")
      .update({ state: "failed", updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", draft.id);
    throw new Error(
      `Company Intelligence Trigger dispatch failed: ${errorMessage(dispatchError)}`,
      { cause: dispatchError },
    );
  }
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

export function isIndeterminateTriggerDispatchError(error: unknown) {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message = errorMessage(error).toLowerCase();
  return (
    name === "aborterror" ||
    /aborted due to timeout|operation was aborted|request timed out|fetch failed.*timeout/.test(
      message,
    )
  );
}

async function ensureCompanyProfileContainer(workspaceId: string) {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("company_profiles")
    .upsert({ workspace_id: workspaceId }, { onConflict: "workspace_id" })
    .select("id")
    .single();
  if (error)
    throw new Error(`Could not repair Company Profile container: ${error.message}`);
  return data;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Trigger.dev error.";
}

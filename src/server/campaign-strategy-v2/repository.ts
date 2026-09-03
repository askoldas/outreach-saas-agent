import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import {
  campaignStrategyV2Schema,
  parseCampaignStrategyV2DraftPayload,
  type CampaignStrategyCompilation,
  type CampaignPlanningOffering,
  type CampaignPlanningProfile,
  type CampaignStrategyV2,
  type CompiledCampaignCommercialContext,
} from "@/lib/intelligence/campaign-strategy-v2";
import { intelligenceRuleSchema } from "@/lib/intelligence/contracts/rules";
import type { AiCallResult } from "@/lib/providers/openrouter";

export class CampaignStrategyDraftSupersededError extends Error {
  constructor() {
    super("The Campaign Strategy draft was superseded or already confirmed.");
    this.name = "CampaignStrategyDraftSupersededError";
  }
}

export type CampaignStrategyEnrichmentStatus = {
  state: "baseline_ready" | "running" | "partially_enriched" | "enriched" | "failed";
  applied: number;
  rejected: number;
  requiresUserReview: number;
  omittedByBudget: number;
  message?: string;
};

export async function getCampaignStrategyV2EnrichmentStatus(
  workspaceId: string,
  strategyDraftId: string,
): Promise<CampaignStrategyEnrichmentStatus> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  type EnrichmentRpc = {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await (supabase as unknown as EnrichmentRpc).rpc(
    "get_campaign_strategy_enrichment_v2",
    {
      target_workspace_id: workspaceId,
      target_strategy_draft_id: strategyDraftId,
    },
  );
  if (error) throw new Error(`Could not load Strategy enrichment: ${error.message}`);
  const rows = Array.isArray(data) ? data.map(objectValue) : [];
  const byStage = new Map(rows.map((row) => [optionalString(row.stage_id), row]));
  const relevant = ["advisory_delta", "compilation"]
    .map((stage) => byStage.get(stage))
    .filter((row): row is Record<string, Json | undefined> => Boolean(row));
  const failed = relevant.find((row) => row.status === "failed");
  if (failed) {
    return {
      state: "failed",
      applied: 0,
      rejected: 0,
      requiresUserReview: 0,
      omittedByBudget: 0,
      message: optionalString(failed.error_message) ?? "Optional enrichment failed.",
    };
  }
  if (relevant.some((row) => row.status === "running")) {
    return {
      state: "running",
      applied: 0,
      rejected: 0,
      requiresUserReview: 0,
      omittedByBudget: 0,
    };
  }
  const compilation = byStage.get("compilation");
  if (compilation?.status !== "completed") {
    return {
      state: "baseline_ready",
      applied: 0,
      rejected: 0,
      requiresUserReview: 0,
      omittedByBudget: 0,
    };
  }
  const summary = objectValue(objectValue(compilation.output_json).dispositionSummary);
  const result = {
    applied: integerValue(summary.applied),
    rejected: integerValue(summary.rejected),
    requiresUserReview: integerValue(summary.requiresUserReview),
    omittedByBudget: integerValue(summary.omittedByBudget),
  };
  return {
    state:
      result.rejected || result.requiresUserReview || result.omittedByBudget
        ? "partially_enriched"
        : "enriched",
    ...result,
  };
}

export async function recordCampaignStrategyModelCalls(input: {
  workspaceId: string;
  strategyDraftId: string;
  inputHash: string;
  calls: Array<{
    taskId: string;
    promptVersion: string;
    schemaVersion: string;
    outputHash: string;
    call: AiCallResult<string>;
  }>;
}) {
  const supabase = createServiceRoleClient();
  type AuditRpc = {
    rpc(
      name: "record_campaign_strategy_ai_requests_v2",
      args: {
        target_requests: Json;
        target_strategy_draft_id: string;
        target_workspace_id: string;
      },
    ): Promise<{ error: { message: string } | null }>;
  };
  const requests = input.calls.map((item) => ({
    role: item.taskId,
    selectedModel: item.call.requestedModel,
    fallbackModel: item.call.fallbackUsed
      ? (item.call.actualModel ?? item.call.requestedModel)
      : "",
    fallbackUsed: item.call.fallbackUsed,
    promptVersion: item.promptVersion,
    schemaVersion: item.schemaVersion,
    requestHash: input.inputHash,
    inputUnits: item.call.inputTokens ?? null,
    outputUnits: item.call.outputTokens ?? null,
    actualCost: item.call.providerReportedCost ?? 0,
    currency: item.call.providerCurrency ?? "USD",
    actualModel: item.call.actualModel ?? null,
    latencyMs: item.call.latencyMs,
    outputHash: item.outputHash,
    providerRequestId: item.call.providerRequestId ?? null,
  }));
  const { error } = await (supabase as unknown as AuditRpc).rpc(
    "record_campaign_strategy_ai_requests_v2",
    {
      target_workspace_id: input.workspaceId,
      target_strategy_draft_id: input.strategyDraftId,
      target_requests: requests as unknown as Json,
    },
  );
  if (error)
    throw new Error(`Could not audit Campaign Strategy model tasks: ${error.message}`);
}

export async function createCampaignStrategyV2Draft(input: {
  workspaceId: string;
  campaignExternalId: string;
  profileVersionId: string;
  campaignInput: Json;
  inputHash: string;
  compiledContext: CompiledCampaignCommercialContext;
}) {
  const { supabase: database } = await createAuthenticatedDatabaseClient();
  const { data, error } = await database.rpc("create_native_campaign_strategy_v2_draft", {
    target_workspace_id: input.workspaceId,
    target_campaign_external_id: input.campaignExternalId,
    target_profile_version_id: input.profileVersionId,
    target_input: input.campaignInput,
    target_input_hash: input.inputHash,
    target_compiled_context: input.compiledContext as unknown as Json,
    target_compiled_context_hash: input.compiledContext.contextHash,
  });
  if (error)
    throw new Error(`Could not create Campaign Strategy V2 draft: ${error.message}`);
  return draftIdentity(data);
}

export async function persistCampaignStrategyV2Compilation(input: {
  workspaceId: string;
  strategyDraftId: string;
  compilation: CampaignStrategyCompilation;
}) {
  const database = createServiceRoleClient();
  const { data, error } = await database.rpc("compile_campaign_strategy_v2_draft", {
    target_workspace_id: input.workspaceId,
    target_strategy_draft_id: input.strategyDraftId,
    target_compilation: input.compilation as unknown as Json,
  });
  if (error)
    throw new Error(`Could not compile Campaign Strategy V2 draft: ${error.message}`);
  return draftIdentity(data);
}

export async function markCampaignStrategyV2Building(input: {
  workspaceId: string;
  strategyDraftId: string;
}) {
  const { error } = await createServiceRoleClient()
    .from("campaign_strategy_drafts")
    .update({ state: "building", updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.strategyDraftId)
    .in("state", ["building", "needs_input", "failed"]);
  if (error) throw new Error(`Could not queue Campaign Strategy draft: ${error.message}`);
}

export async function failCampaignStrategyV2Draft(input: {
  workspaceId: string;
  strategyDraftId: string;
  error: unknown;
}) {
  const message =
    input.error instanceof Error ? input.error.message : "Strategy compilation failed.";
  const supabase = createServiceRoleClient();
  const { data: draft } = await supabase
    .from("campaign_strategy_drafts")
    .select("campaign_id")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.strategyDraftId)
    .maybeSingle();
  await supabase
    .from("campaign_strategy_drafts")
    .update({ state: "failed", updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.strategyDraftId)
    .neq("state", "ready_for_review")
    .neq("state", "confirmed");
  if (draft?.campaign_id) {
    await supabase.from("campaign_strategy_events").insert({
      workspace_id: input.workspaceId,
      campaign_id: draft.campaign_id,
      campaign_strategy_draft_id: input.strategyDraftId,
      event_type: "draft_compilation_failed",
      actor_type: "system",
      affected_paths: ["strategy"],
      details_json: { message: message.slice(0, 2_000) },
    });
  }
}

export async function confirmCampaignStrategyV2(input: {
  workspaceId: string;
  strategyDraftId: string;
}) {
  const { supabase: database } = await createAuthenticatedDatabaseClient();
  const { data, error } = await database.rpc("confirm_campaign_strategy_v2", {
    target_workspace_id: input.workspaceId,
    target_strategy_draft_id: input.strategyDraftId,
  });
  if (error) throw new Error(`Could not confirm Campaign Strategy V2: ${error.message}`);
  const row = objectValue(data);
  const strategy = campaignStrategyV2Schema.parse(row.strategy);
  return {
    id: stringValue(row.id, "Confirmed strategy ID"),
    version: numberValue(row.version, "Confirmed strategy version"),
    strategy,
  };
}

export function parsePersistedCampaignStrategyV2(value: unknown): CampaignStrategyV2 {
  return campaignStrategyV2Schema.parse(value);
}

export async function getCurrentCampaignStrategyV2Draft(
  workspaceId: string,
  campaignExternalId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("current_strategy_draft_id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .single();
  if (campaignError)
    throw new Error(
      `Could not load V2 Campaign Strategy reference: ${campaignError.message}`,
    );
  if (!campaign.current_strategy_draft_id) return null;
  const { data, error } = await supabase
    .from("campaign_strategy_drafts")
    .select(
      "id,state,contract_version,compiled_draft_json,compiled_context_hash,content_hash,updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", campaign.current_strategy_draft_id)
    .single();
  if (error) throw new Error(`Could not load V2 Campaign Strategy: ${error.message}`);
  return {
    id: data.id,
    state: data.state,
    contractVersion: data.contract_version,
    contextHash: data.compiled_context_hash,
    contentHash: data.content_hash,
    updatedAt: data.updated_at,
    strategy: parseCampaignStrategyV2DraftPayload(data.state, data.compiled_draft_json),
  };
}

export async function getCampaignStrategyV2RecoveryData(input: {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,current_strategy_draft_id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignExternalId)
    .single();
  if (campaignError) {
    throw new Error(
      `Could not load Campaign Strategy recovery reference: ${campaignError.message}`,
    );
  }
  if (campaign.current_strategy_draft_id !== input.strategyDraftId) {
    throw new CampaignStrategyDraftSupersededError();
  }
  const { data, error } = await supabase
    .from("campaign_strategy_drafts")
    .select(
      "id,state,campaign_id,profile_intelligence_version_id,compiled_context_json,compiled_context_hash,campaign_input:campaign_inputs!inner(geography_json,objective_json,offering_references_json,initial_hypothesis_json,requested_volume)",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaign.id)
    .eq("id", input.strategyDraftId)
    .single();
  if (error) {
    throw new Error(`Could not load Campaign Strategy recovery data: ${error.message}`);
  }
  const campaignInput = Array.isArray(data.campaign_input)
    ? data.campaign_input[0]
    : data.campaign_input;
  if (!campaignInput) {
    throw new Error("The recoverable Campaign Strategy input is missing.");
  }
  return {
    id: data.id,
    state: data.state,
    campaignId: data.campaign_id,
    profileVersionId: data.profile_intelligence_version_id,
    compiledContext: data.compiled_context_json,
    compiledContextHash: data.compiled_context_hash,
    geography: campaignInput.geography_json,
    objective: campaignInput.objective_json,
    offeringReferences: campaignInput.offering_references_json,
    initialHypothesis: campaignInput.initial_hypothesis_json,
    requestedVolume: campaignInput.requested_volume,
  };
}

export async function getCurrentConfirmedCampaignStrategyV2(
  workspaceId: string,
  campaignExternalId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "strategy:campaign_strategy_versions!campaigns_current_strategy_fk(id,version,confirmation_status,strategy,confirmed_at)",
    )
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .maybeSingle();
  if (error) throw new Error(`Could not load confirmed V2 Strategy: ${error.message}`);
  const strategyRow = Array.isArray(data?.strategy) ? data.strategy[0] : data?.strategy;
  if (!strategyRow || strategyRow.confirmation_status !== "confirmed") return null;
  return {
    id: strategyRow.id,
    version: strategyRow.version,
    confirmedAt: strategyRow.confirmed_at,
    strategy: campaignStrategyV2Schema.parse(strategyRow.strategy),
  };
}

export async function getPublishedCampaignProfileContext(
  workspaceId: string,
  selectedOfferingStableKey: string,
) {
  const profile = await getPublishedCampaignPlanningProfile(workspaceId);
  if (!profile) {
    throw new Error("A published Company Intelligence V3 profile is required.");
  }
  const offering = profile.offerings.find(
    (candidate) => candidate.stableKey === selectedOfferingStableKey,
  );
  if (!offering) {
    throw new Error(
      "The selected offering is not available in the published V3 profile.",
    );
  }
  return {
    ...profile,
    offering,
    offeringId: offering.offeringId,
    offeringStableKey: offering.stableKey,
    offeringVersion: {
      id: offering.offeringVersionId,
      name: offering.name,
      short_description: offering.shortDescription,
      commercial_mechanics_json: offering.commercialMechanics,
      buyer_logic_json: offering.buyerLogic,
      relationship_options_json: offering.relationshipOptions,
    },
  };
}

export async function getPublishedCampaignPlanningProfile(
  workspaceId: string,
): Promise<CampaignPlanningProfile | null> {
  const supabase = createServiceRoleClient();
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("id,current_version_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (profileError)
    throw new Error(`Could not load Company Intelligence: ${profileError.message}`);
  if (!profile?.current_version_id) return null;
  const [
    { data: profileVersion, error: versionError },
    { data: roles, error: rolesError },
    { data: offeringVersions, error: offeringVersionError },
    { data: rules, error: rulesError },
  ] = await Promise.all([
    supabase
      .from("company_profile_versions")
      .select(
        "id,intelligence_version,profile_status,company_name,summary,structured_profile",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", profile.current_version_id)
      .single(),
    supabase
      .from("company_business_roles")
      .select(
        "role_type,business_model:company_business_models!inner(profile_version_id)",
      )
      .eq("workspace_id", workspaceId)
      .eq("business_model.profile_version_id", profile.current_version_id),
    supabase
      .from("company_offering_versions")
      .select(
        "id,company_offering_id,slug,name,status,offering_type,short_description,commercial_mechanics_json,buyer_logic_json,relationship_options_json,confidence",
      )
      .eq("workspace_id", workspaceId)
      .eq("profile_version_id", profile.current_version_id)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("commercial_rules")
      .select(
        "rule_key,scope,scope_id,rule_type,strength,status,source,description,applicability_json,confidence,evidence_ids",
      )
      .eq("workspace_id", workspaceId)
      .eq("profile_version_id", profile.current_version_id)
      .neq("status", "rejected")
      .order("rule_key"),
  ]);
  if (
    versionError ||
    profileVersion.intelligence_version !== "v2" ||
    profileVersion.profile_status !== "published" ||
    !isNativePublishedProfile(profileVersion.structured_profile)
  ) {
    throw new Error("The current Company Profile is not a published V3 version.");
  }
  if (rolesError) throw new Error(`Could not load Company roles: ${rolesError.message}`);
  if (offeringVersionError) {
    throw new Error(
      `Could not load published offering versions: ${offeringVersionError.message}`,
    );
  }
  if (rulesError)
    throw new Error(`Could not load commercial rules: ${rulesError.message}`);
  if (!offeringVersions?.length) {
    throw new Error("The published V3 profile has no active offering.");
  }
  const offeringEntityIds = offeringVersions.map(
    (offering) => offering.company_offering_id,
  );
  const offeringVersionIds = offeringVersions.map((offering) => offering.id);
  const [
    { data: offeringEntities, error: entityError },
    { data: archetypes, error: archetypeError },
  ] = await Promise.all([
    supabase
      .from("company_offerings")
      .select("id,stable_key")
      .eq("workspace_id", workspaceId)
      .eq("company_profile_id", profile.id)
      .in("id", offeringEntityIds)
      .is("archived_at", null),
    supabase
      .from("buyer_archetype_hypotheses")
      .select(
        "offering_version_id,archetype_key,name,relationship_type,priority,status,structured_details_json,confidence,evidence_ids",
      )
      .eq("workspace_id", workspaceId)
      .eq("profile_version_id", profileVersion.id)
      .in("offering_version_id", offeringVersionIds)
      .order("name"),
  ]);
  if (entityError)
    throw new Error(`Could not load published offerings: ${entityError.message}`);
  if (archetypeError)
    throw new Error(`Could not load buyer archetypes: ${archetypeError.message}`);
  const entityById = new Map((offeringEntities ?? []).map((row) => [row.id, row]));
  const offerings: CampaignPlanningOffering[] = offeringVersions.map((row) => {
    const entity = entityById.get(row.company_offering_id);
    if (!entity) {
      throw new Error(`Published offering ${row.name} has no stable entity.`);
    }
    const mechanics = objectValue(row.commercial_mechanics_json);
    const buyerLogic = objectValue(row.buyer_logic_json);
    return {
      stableKey: entity.stable_key,
      offeringId: entity.id,
      offeringVersionId: row.id,
      slug: row.slug,
      name: row.name,
      offeringType: row.offering_type,
      shortDescription: row.short_description,
      confidence: numericValue(row.confidence),
      commercialMechanics: {
        buyingMotion: optionalString(mechanics.buyingMotion) ?? "unknown",
        customerConsumptionMode:
          optionalString(mechanics.customerConsumptionMode) ?? "unknown",
        dependencies: stringArray(mechanics.dependencies),
        valueProposition: stringArray(mechanics.valueProposition),
        customerProblems: stringArray(mechanics.customerProblems),
        expectedOutcomes: stringArray(mechanics.expectedOutcomes),
        transactionModels: stringArray(mechanics.transactionModels),
      },
      buyerLogic: {
        offeringKey: optionalString(buyerLogic.offeringKey) ?? entity.stable_key,
        whyBuy: stringArray(buyerLogic.whyBuy),
        requiredConditions: stringArray(buyerLogic.requiredConditions),
        preferredConditions: stringArray(buyerLogic.preferredConditions),
        likelyTriggers: stringArray(buyerLogic.likelyTriggers),
        incompatibleConditions: stringArray(buyerLogic.incompatibleConditions),
        likelyDecisionRoles: stringArray(buyerLogic.likelyDecisionRoles),
        ...(optionalString(buyerLogic.procurementPattern)
          ? { procurementPattern: optionalString(buyerLogic.procurementPattern) }
          : {}),
        positiveEvidenceSignals: stringArray(buyerLogic.positiveEvidenceSignals),
        negativeEvidenceSignals: stringArray(buyerLogic.negativeEvidenceSignals),
        evidenceIds: stringArray(buyerLogic.evidenceIds),
        confidence: numericValue(buyerLogic.confidence),
      },
      relationshipOptions: arrayValue(row.relationship_options_json).map((value) => {
        const option = objectValue(value);
        return {
          relationshipType: optionalString(option.relationshipType) ?? "other",
          relevance: optionalString(option.relevance) ?? "possible",
          rationale:
            optionalString(option.rationale) ??
            "Relationship compatibility requires campaign review.",
          confidence: numericValue(option.confidence),
        };
      }),
      archetypes: (archetypes ?? [])
        .filter((archetype) => archetype.offering_version_id === row.id)
        .map((archetype) => {
          const details = objectValue(archetype.structured_details_json);
          return {
            key: archetype.archetype_key,
            name: archetype.name,
            relationshipType: archetype.relationship_type,
            priority:
              archetype.priority as CampaignPlanningOffering["archetypes"][number]["priority"],
            status:
              archetype.status as CampaignPlanningOffering["archetypes"][number]["status"],
            description:
              optionalString(details.description) ??
              `Organizations compatible with ${row.name}.`,
            whyCompatible: stringArray(details.whyCompatible),
            requiredEvidence: stringArray(details.requiredEvidence),
            positiveSignals: stringArray(details.positiveSignals),
            negativeSignals: stringArray(details.negativeSignals),
            likelyDecisionRoles: stringArray(details.likelyDecisionRoles),
            confidence: numericValue(archetype.confidence),
            evidenceIds: archetype.evidence_ids,
          };
        }),
    };
  });
  const snapshot = objectValue(profileVersion.structured_profile);
  const identity = objectValue(snapshot.identity);
  const versionByIdentifier = new Map<string, string>();
  for (const offering of offerings) {
    versionByIdentifier.set(offering.stableKey, offering.offeringVersionId);
    versionByIdentifier.set(offering.offeringId, offering.offeringVersionId);
    versionByIdentifier.set(offering.offeringVersionId, offering.offeringVersionId);
  }
  return {
    profileVersionId: profileVersion.id,
    companyName: profileVersion.company_name,
    commercialSummary: profileVersion.summary,
    primaryLanguage: optionalString(identity.primaryLanguage) ?? "English",
    supportedLanguages: stringArray(identity.supportedLanguages),
    companyRoles: (roles ?? []).map((role) => role.role_type),
    offerings,
    rules: (rules ?? []).map((row) => {
      const applicability = objectValue(row.applicability_json);
      const identifiers = stringArray(applicability.offeringIds);
      if (row.scope === "offering" && !identifiers.length) {
        identifiers.push(row.scope_id);
      }
      return intelligenceRuleSchema.parse({
        ruleKey: row.rule_key,
        label: humanize(row.rule_key),
        description: row.description,
        ruleType: row.rule_type,
        scope: row.scope,
        strength: row.strength,
        applicability: {
          objectives: stringArray(applicability.objectives),
          offeringIds: identifiers
            .map((identifier) => versionByIdentifier.get(identifier))
            .filter((identifier): identifier is string => Boolean(identifier)),
          geographies: stringArray(applicability.geographies),
          relationshipTypes: stringArray(applicability.relationshipTypes),
          archetypeIds: stringArray(applicability.archetypeIds),
        },
        status: row.status,
        source: row.source === "user" || row.source === "system" ? row.source : "profile",
        evidenceIds: row.evidence_ids,
        confidence: numericValue(row.confidence),
      });
    }),
  };
}

function draftIdentity(value: unknown) {
  const row = objectValue(value);
  return {
    id: stringValue(row.id, "Campaign Strategy draft ID"),
    state: stringValue(row.state, "Campaign Strategy draft state"),
  };
}

function objectValue(value: unknown): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Json | undefined>;
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value) throw new Error(`${label} is missing.`);
  return value;
}

function numberValue(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

function arrayValue(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: Json | undefined) {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function optionalString(value: Json | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numericValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function integerValue(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function humanize(value: string) {
  const label = value.replaceAll(/[-_.]+/g, " ").trim();
  return label ? label[0]!.toUpperCase() + label.slice(1) : "Commercial rule";
}

function isNativePublishedProfile(value: Json) {
  const snapshot = objectValue(value);
  const sourceSet = objectValue(snapshot.sourceSet);
  const offerings = objectValue(snapshot.offerings);
  return (
    snapshot.schemaVersion === 3 &&
    sourceSet.contractVersion === "company-profile-source-set/v1" &&
    sourceSet.kind === "official_website" &&
    Array.isArray(offerings.offerings)
  );
}

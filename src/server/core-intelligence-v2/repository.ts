import {
  campaignTargetModelSchema,
  companyIntelligenceSchema,
  commercialRelationshipAssessmentSchema,
  commercialIntelligenceSchema,
  marketAnalysisSchema,
  marketResearchPlanSchema,
  researchBlueprintSchema,
  type CampaignTargetModel,
  type CompanyIntelligence,
  type CommercialRelationshipAssessment,
  type CommercialIntelligence,
  type MarketAnalysis,
  type MarketResearchPlan,
  type ResearchBlueprint,
} from "@/lib/intelligence/core";
import {
  discoveryProviderCapabilitiesSchema,
  type DiscoveryProviderCapabilities,
} from "@/lib/discovery-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";

type DatabaseError = { code?: string; message: string };
type DatabaseResult = PromiseLike<{ data: unknown; error: DatabaseError | null }>;
type SelectBuilder = {
  eq(column: string, value: unknown): SelectBuilder;
  order(column: string, options: { ascending: boolean }): SelectBuilder;
  limit(count: number): SelectBuilder;
  maybeSingle(): DatabaseResult;
  single(): DatabaseResult;
};
type InsertBuilder = { select(columns?: string): { single(): DatabaseResult } };
type ArtifactDatabase = {
  from(table: string): {
    insert(value: Record<string, unknown>): InsertBuilder;
    select(columns?: string): SelectBuilder;
  };
};

export type PersistedArtifact<T> = {
  id: string;
  version: number;
  artifact: T;
  createdAt: string;
  cached: boolean;
};

export async function loadLatestCommercialIntelligenceVersionNumber(input: {
  workspaceId: string;
  companyProfileVersionId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("commercial_intelligence_versions_v2")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("company_profile_version_id", input.companyProfileVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load latest version from",
      "commercial_intelligence_versions_v2",
      result.error,
    );
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Commercial Intelligence returned an invalid version number.");
  }
  return version;
}

export async function loadCommercialIntelligenceVersion(input: {
  workspaceId: string;
  id: string;
}) {
  return loadArtifactById({
    table: "commercial_intelligence_versions_v2",
    payloadColumn: "intelligence_json",
    workspaceId: input.workspaceId,
    id: input.id,
    parse: commercialIntelligenceSchema.parse,
  });
}

export async function loadLatestCampaignTargetModelVersionNumber(input: {
  workspaceId: string;
  campaignId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("campaign_target_model_versions_v2")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load latest version from",
      "campaign_target_model_versions_v2",
      result.error,
    );
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Campaign Target Model returned an invalid version number.");
  }
  return version;
}

export async function loadCampaignTargetModelVersion(input: {
  workspaceId: string;
  id: string;
}) {
  return loadArtifactById({
    table: "campaign_target_model_versions_v2",
    payloadColumn: "target_model_json",
    workspaceId: input.workspaceId,
    id: input.id,
    parse: campaignTargetModelSchema.parse,
  });
}

export async function loadLatestMarketAnalysisVersionNumber(input: {
  workspaceId: string;
  campaignRunId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("market_analyses")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure("load latest version from", "market_analyses", result.error);
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Market Analysis returned an invalid version number.");
  }
  return version;
}

export async function loadMarketAnalysisVersion(input: {
  workspaceId: string;
  id: string;
}) {
  return loadArtifactById({
    table: "market_analyses",
    payloadColumn: "analysis",
    workspaceId: input.workspaceId,
    id: input.id,
    parse: marketAnalysisSchema.parse,
  });
}

export async function isMarketAnalysisConfirmed(input: {
  workspaceId: string;
  campaignId: string;
  marketAnalysisId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("market_analysis_confirmations_v2")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .eq("market_analysis_id", input.marketAnalysisId)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load confirmation from",
      "market_analysis_confirmations_v2",
      result.error,
    );
  }
  return Boolean(result.data);
}

export async function loadProviderCapabilitySnapshots(input: {
  workspaceId: string;
  ids: string[];
}): Promise<Array<{ snapshotId: string; capabilities: DiscoveryProviderCapabilities }>> {
  if (!input.ids.length || new Set(input.ids).size !== input.ids.length) {
    throw new Error("Provider capability snapshot IDs must be unique and non-empty.");
  }
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  return Promise.all(
    [...input.ids].sort().map(async (id) => {
      const result = await database
        .from("discovery_provider_capability_snapshots")
        .select("id,capabilities_json")
        .eq("workspace_id", input.workspaceId)
        .eq("id", id)
        .single();
      if (result.error) {
        throw databaseFailure(
          "load",
          "discovery_provider_capability_snapshots",
          result.error,
        );
      }
      if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
        throw new Error("Provider capability snapshot returned an invalid row.");
      }
      const row = result.data as Record<string, unknown>;
      if (row.id !== id)
        throw new Error("Provider capability snapshot identity mismatch.");
      return {
        snapshotId: id,
        capabilities: discoveryProviderCapabilitiesSchema.parse(row.capabilities_json),
      };
    }),
  );
}

export async function loadLatestMarketResearchPlanVersionNumber(input: {
  workspaceId: string;
  campaignId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("market_research_plan_versions_v2")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load latest version from",
      "market_research_plan_versions_v2",
      result.error,
    );
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Market Research Plan returned an invalid version number.");
  }
  return version;
}

export async function loadLatestResearchBlueprintVersionNumber(input: {
  workspaceId: string;
  campaignId: string;
  targetArchetypeId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("research_blueprint_versions_v2")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .eq("target_archetype_id", input.targetArchetypeId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load latest version from",
      "research_blueprint_versions_v2",
      result.error,
    );
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Research Blueprint returned an invalid version number.");
  }
  return version;
}

export async function loadLatestCompanyIntelligenceVersionNumber(input: {
  workspaceId: string;
  organizationId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("company_intelligence_versions_v2")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("organization_id", input.organizationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load latest version from",
      "company_intelligence_versions_v2",
      result.error,
    );
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Company Intelligence returned an invalid version number.");
  }
  return version;
}

export async function loadLatestCommercialRelationshipAssessmentVersionNumber(input: {
  workspaceId: string;
  campaignId: string;
  organizationId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("commercial_relationship_assessment_versions_v2")
    .select("version")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .eq("organization_id", input.organizationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw databaseFailure(
      "load latest version from",
      "commercial_relationship_assessment_versions_v2",
      result.error,
    );
  }
  if (!result.data) return 0;
  const version = (result.data as { version?: unknown }).version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Commercial Relationship assessment returned an invalid version.");
  }
  return version;
}

export async function loadCommercialRelationshipAssessmentVersion(input: {
  workspaceId: string;
  id: string;
}) {
  return loadArtifactById({
    table: "commercial_relationship_assessment_versions_v2",
    payloadColumn: "assessment_json",
    workspaceId: input.workspaceId,
    id: input.id,
    parse: commercialRelationshipAssessmentSchema.parse,
  });
}

export async function loadCompanyIntelligenceVersion(input: {
  workspaceId: string;
  id: string;
}) {
  return loadArtifactById({
    table: "company_intelligence_versions_v2",
    payloadColumn: "intelligence_json",
    workspaceId: input.workspaceId,
    id: input.id,
    parse: companyIntelligenceSchema.parse,
  });
}

export async function loadCompanyIntelligenceForCandidateSource(input: {
  workspaceId: string;
  sourceCandidateIntelligenceVersionId: string;
}) {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from("company_intelligence_versions_v2")
    .select("id,version,created_at,intelligence_json")
    .eq("workspace_id", input.workspaceId)
    .eq(
      "source_candidate_intelligence_version_id",
      input.sourceCandidateIntelligenceVersionId,
    )
    .maybeSingle();
  if (result.error) {
    throw databaseFailure("load", "company_intelligence_versions_v2", result.error);
  }
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    return null;
  }
  const row = result.data as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.version !== "number" ||
    typeof row.created_at !== "string"
  ) {
    throw new Error("Company Intelligence returned incomplete artifact identity.");
  }
  const artifact = companyIntelligenceSchema.parse(row.intelligence_json);
  if (artifact.id !== row.id) {
    throw new Error("Company Intelligence persistence identity mismatch.");
  }
  return {
    id: row.id,
    version: row.version,
    artifact,
    createdAt: row.created_at,
    cached: true,
  };
}

export async function loadLatestResearchBlueprints(input: {
  workspaceId: string;
  campaignId: string;
  campaignTargetModelVersionId?: string;
  marketAnalysisVersionId?: string;
}) {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("research_blueprint_versions_v2")
    .select(
      "id,target_archetype_id,campaign_target_model_version_id,market_analysis_id,version,blueprint_json",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId);
  if (input.campaignTargetModelVersionId) {
    query = query.eq(
      "campaign_target_model_version_id",
      input.campaignTargetModelVersionId,
    );
  }
  if (input.marketAnalysisVersionId) {
    query = query.eq("market_analysis_id", input.marketAnalysisVersionId);
  }
  const { data, error } = await query
    .order("version", { ascending: false })
    .order("target_archetype_id", { ascending: true });
  if (error) {
    throw new Error(`Could not load Research Blueprints: ${error.message}`);
  }
  const latest = new Map<string, ResearchBlueprint>();
  for (const row of data ?? []) {
    if (latest.has(row.target_archetype_id)) continue;
    const blueprint = researchBlueprintSchema.parse(row.blueprint_json);
    if (
      blueprint.id !== row.id ||
      blueprint.targetArchetypeId !== row.target_archetype_id ||
      blueprint.campaignTargetModelVersionId !== row.campaign_target_model_version_id ||
      blueprint.marketAnalysisVersionId !== row.market_analysis_id
    ) {
      throw new Error("Research Blueprint persistence identity mismatch.");
    }
    latest.set(row.target_archetype_id, blueprint);
  }
  return [...latest.values()].sort((a, b) =>
    a.targetArchetypeId.localeCompare(b.targetArchetypeId),
  );
}

export async function persistCommercialIntelligence(input: {
  artifact: CommercialIntelligence;
  versionNumber: number;
}) {
  const artifact = commercialIntelligenceSchema.parse(input.artifact);
  return persistImmutableArtifact({
    table: "commercial_intelligence_versions_v2",
    payloadColumn: "intelligence_json",
    ownerColumn: "company_profile_version_id",
    ownerId: artifact.companyProfileVersionId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: commercialIntelligenceSchema.parse,
    extra: {
      evidence_ids: artifact.evidenceIds,
      confidence: artifact.confidence,
      prompt_version: artifact.version.promptVersion ?? null,
      model_role: artifact.version.modelRole ?? null,
      provider: artifact.version.provider ?? null,
      model: artifact.version.model ?? null,
    },
  });
}

export async function persistCampaignTargetModel(input: {
  artifact: CampaignTargetModel;
  versionNumber: number;
}) {
  const artifact = campaignTargetModelSchema.parse(input.artifact);
  return persistImmutableArtifact({
    table: "campaign_target_model_versions_v2",
    payloadColumn: "target_model_json",
    ownerColumn: "campaign_id",
    ownerId: artifact.campaignId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: campaignTargetModelSchema.parse,
    extra: {
      profile_snapshot_id: artifact.profileSnapshotId,
      commercial_intelligence_version_id: artifact.commercialIntelligenceVersionId,
      evidence_ids: uniqueEvidenceIds(artifact),
      confidence: artifact.confidence,
    },
  });
}

export async function persistMarketAnalysis(input: {
  artifact: MarketAnalysis;
  campaignRunId: string;
  profileSnapshotId: string;
  requestedModel: string;
  actualModel: string;
  fallbackUsed: boolean;
  campaignStrategyVersionId?: string;
  supersedesMarketAnalysisId?: string;
  versionNumber: number;
}) {
  const artifact = marketAnalysisSchema.parse(input.artifact);
  const model = requiredModelProvenance(artifact);
  if (
    !input.requestedModel.trim() ||
    !input.actualModel.trim() ||
    input.actualModel !== model.model
  ) {
    throw new Error(
      "Market Analysis execution provenance is incomplete or inconsistent.",
    );
  }
  return persistImmutableArtifact({
    table: "market_analyses",
    payloadColumn: "analysis",
    ownerColumn: "campaign_id",
    ownerId: artifact.campaignId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: marketAnalysisSchema.parse,
    extra: {
      campaign_run_id: input.campaignRunId,
      profile_snapshot_id: input.profileSnapshotId,
      commercial_intelligence_version_id: artifact.commercialIntelligenceVersionId,
      campaign_target_model_version_id: artifact.campaignTargetModelVersionId,
      campaign_strategy_version_id: input.campaignStrategyVersionId ?? null,
      prompt_version: artifact.version.promptVersion,
      requested_model: input.requestedModel,
      actual_model: input.actualModel,
      fallback_used: input.fallbackUsed,
      model_role: model.modelRole,
      evidence_ids: artifact.evidenceIds,
      confidence: artifact.confidence,
      requires_user_confirmation: artifact.requiresUserConfirmation,
      supersedes_market_analysis_id: input.supersedesMarketAnalysisId ?? null,
    },
  });
}

export async function persistMarketResearchPlan(input: {
  artifact: MarketResearchPlan;
  campaignRunId?: string;
  versionNumber: number;
}) {
  const artifact = marketResearchPlanSchema.parse(input.artifact);
  return persistImmutableArtifact({
    table: "market_research_plan_versions_v2",
    payloadColumn: "plan_json",
    ownerColumn: "campaign_id",
    ownerId: artifact.campaignId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: marketResearchPlanSchema.parse,
    extra: {
      campaign_run_id: input.campaignRunId ?? null,
      market_analysis_id: artifact.marketAnalysisVersionId,
      campaign_target_model_version_id: artifact.campaignTargetModelVersionId,
      provider_capability_snapshot_ids: artifact.providerCapabilitySnapshotIds,
    },
  });
}

export async function persistResearchBlueprint(input: {
  artifact: ResearchBlueprint;
  versionNumber: number;
}) {
  const artifact = researchBlueprintSchema.parse(input.artifact);
  return persistImmutableArtifact({
    table: "research_blueprint_versions_v2",
    payloadColumn: "blueprint_json",
    ownerColumn: "campaign_id",
    ownerId: artifact.campaignId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: researchBlueprintSchema.parse,
    extra: {
      campaign_target_model_version_id: artifact.campaignTargetModelVersionId,
      market_analysis_id: artifact.marketAnalysisVersionId,
      target_archetype_id: artifact.targetArchetypeId,
    },
  });
}

export async function persistCompanyIntelligence(input: {
  artifact: CompanyIntelligence;
  sourceCandidateIntelligenceVersionId: string;
  versionNumber: number;
}) {
  const artifact = companyIntelligenceSchema.parse(input.artifact);
  return persistImmutableArtifact({
    table: "company_intelligence_versions_v2",
    payloadColumn: "intelligence_json",
    ownerColumn: "organization_id",
    ownerId: artifact.organizationId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: companyIntelligenceSchema.parse,
    extra: {
      source_candidate_intelligence_version_id:
        input.sourceCandidateIntelligenceVersionId,
      research_blueprint_version_ids: artifact.researchBlueprintVersionIds,
      evidence_ids: artifact.evidenceIds,
      confidence: artifact.confidence,
    },
  });
}

export async function persistCommercialRelationshipAssessment(input: {
  artifact: CommercialRelationshipAssessment;
  matchedArchetypeIds: string[];
  versionNumber: number;
}) {
  const artifact = commercialRelationshipAssessmentSchema.parse(input.artifact);
  return persistImmutableArtifact({
    table: "commercial_relationship_assessment_versions_v2",
    payloadColumn: "assessment_json",
    ownerColumn: "campaign_id",
    ownerId: artifact.campaignId,
    workspaceId: artifact.workspaceId,
    versionNumber: input.versionNumber,
    artifact,
    parse: commercialRelationshipAssessmentSchema.parse,
    extra: {
      organization_id: artifact.organizationId,
      company_intelligence_version_id: artifact.companyIntelligenceVersionId,
      campaign_target_model_version_id: artifact.campaignTargetModelVersionId,
      matched_archetype_ids: [...new Set(input.matchedArchetypeIds)].sort(),
    },
  });
}

async function persistImmutableArtifact<T>(input: {
  table: string;
  payloadColumn: string;
  ownerColumn: string;
  ownerId: string;
  workspaceId: string;
  versionNumber: number;
  artifact: T & {
    version: {
      inputHash: string;
      contentHash: string;
      schemaVersion: string;
      compilerVersion: string;
      createdAt: string;
    };
  };
  parse: (value: unknown) => T;
  extra: Record<string, unknown>;
}): Promise<PersistedArtifact<T>> {
  if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new Error("Artifact version number must be a positive integer.");
  }
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const existing = await database
    .from(input.table)
    .select(`id,version,created_at,${input.payloadColumn}`)
    .eq("workspace_id", input.workspaceId)
    .eq(input.ownerColumn, input.ownerId)
    .eq("input_hash", input.artifact.version.inputHash)
    .eq("schema_version", input.artifact.version.schemaVersion)
    .eq("compiler_version", input.artifact.version.compilerVersion)
    .maybeSingle();
  if (existing.error) throw databaseFailure("inspect", input.table, existing.error);
  if (existing.data) return parseArtifactRow(input, existing.data, true);

  const inserted = await database
    .from(input.table)
    .insert({
      id: artifactId(input.artifact),
      workspace_id: input.workspaceId,
      [input.ownerColumn]: input.ownerId,
      version: input.versionNumber,
      [input.payloadColumn]: input.artifact,
      input_hash: input.artifact.version.inputHash,
      content_hash: input.artifact.version.contentHash,
      schema_version: input.artifact.version.schemaVersion,
      compiler_version: input.artifact.version.compilerVersion,
      created_at: input.artifact.version.createdAt,
      ...input.extra,
    })
    .select(`id,version,created_at,${input.payloadColumn}`)
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      return loadCachedAfterConflict(input, database);
    }
    throw databaseFailure("persist", input.table, inserted.error);
  }
  return parseArtifactRow(input, inserted.data, false);
}

async function loadArtifactById<T>(input: {
  table: string;
  payloadColumn: string;
  workspaceId: string;
  id: string;
  parse: (value: unknown) => T;
}): Promise<T> {
  const database = createServiceRoleClient() as unknown as ArtifactDatabase;
  const result = await database
    .from(input.table)
    .select(`id,${input.payloadColumn}`)
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.id)
    .single();
  if (result.error) throw databaseFailure("load", input.table, result.error);
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw new Error(`${input.table} returned an invalid artifact row.`);
  }
  const row = result.data as Record<string, unknown>;
  const artifact = input.parse(row[input.payloadColumn]);
  if (artifactId(artifact) !== row.id || row.id !== input.id) {
    throw new Error(`${input.table} artifact payload identity does not match its row.`);
  }
  return artifact;
}

async function loadCachedAfterConflict<T>(
  input: Parameters<typeof persistImmutableArtifact<T>>[0],
  database: ArtifactDatabase,
) {
  const cached = await database
    .from(input.table)
    .select(`id,version,created_at,${input.payloadColumn}`)
    .eq("workspace_id", input.workspaceId)
    .eq(input.ownerColumn, input.ownerId)
    .eq("input_hash", input.artifact.version.inputHash)
    .eq("schema_version", input.artifact.version.schemaVersion)
    .eq("compiler_version", input.artifact.version.compilerVersion)
    .maybeSingle();
  if (cached.error || !cached.data) {
    throw databaseFailure(
      "reload",
      input.table,
      cached.error ?? { message: "Artifact conflict did not resolve to a cached row." },
    );
  }
  return parseArtifactRow(input, cached.data, true);
}

function parseArtifactRow<T>(
  input: Parameters<typeof persistImmutableArtifact<T>>[0],
  value: unknown,
  cached: boolean,
): PersistedArtifact<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${input.table} returned an invalid artifact row.`);
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.version !== "number" ||
    typeof row.created_at !== "string"
  ) {
    throw new Error(`${input.table} returned incomplete artifact identity.`);
  }
  const artifact = input.parse(row[input.payloadColumn]);
  if (artifactId(artifact) !== row.id) {
    throw new Error(`${input.table} artifact payload identity does not match its row.`);
  }
  return {
    id: row.id,
    version: row.version,
    artifact,
    createdAt: row.created_at,
    cached,
  };
}

function artifactId(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof (value as { id?: unknown }).id !== "string"
  ) {
    throw new Error("Artifact payload requires a stable ID.");
  }
  return (value as { id: string }).id;
}

function requiredModelProvenance(artifact: MarketAnalysis) {
  const { modelRole, provider, model, promptVersion } = artifact.version;
  if (!modelRole || !provider || !model || !promptVersion) {
    throw new Error("Persisted Market Analysis requires complete model provenance.");
  }
  return { modelRole, provider, model, promptVersion };
}

function uniqueEvidenceIds(artifact: CampaignTargetModel) {
  return [
    ...new Set([
      ...artifact.requiredSignals.flatMap(({ evidenceIds }) => evidenceIds),
      ...artifact.positiveSignals.flatMap(({ evidenceIds }) => evidenceIds),
      ...artifact.negativeSignals.flatMap(({ evidenceIds }) => evidenceIds),
      ...artifact.archetypes.flatMap(({ evidenceIds }) => evidenceIds),
    ]),
  ].sort();
}

function databaseFailure(action: string, table: string, error: DatabaseError) {
  return new Error(`Could not ${action} ${table}: ${error.message}`);
}

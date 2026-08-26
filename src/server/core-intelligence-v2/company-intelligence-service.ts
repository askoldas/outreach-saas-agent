import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  compileCompanyIntelligence,
  type CompanyIntelligence,
  type ReusableResearchClaim,
} from "@/lib/intelligence/core";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  loadCompanyIntelligenceForCandidateSource,
  loadLatestCompanyIntelligenceVersionNumber,
  persistCompanyIntelligence,
  type PersistedArtifact,
} from "./repository";

export class CompanyIntelligenceSourceIneligibleError extends Error {}

const sourceSchema = z
  .object({
    organizationId: z.string().min(1),
    claims: z.array(z.custom<ReusableResearchClaim>()),
    unresolvedQuestionKeys: z.array(z.string()),
    conflictKeys: z.array(z.string()),
    researchPlanId: z.string().min(1),
  })
  .passthrough();

export type CompanyIntelligenceCompilationSource = {
  sourceCandidateIntelligenceVersionId: string;
  organization: Parameters<typeof compileCompanyIntelligence>[0]["organization"];
  researchBlueprintVersionIds: string[];
  claims: ReusableResearchClaim[];
  unresolvedQuestionKeys: string[];
  conflictKeys: string[];
};

export type CompanyIntelligenceServiceAdapters = {
  loadSource: (input: {
    workspaceId: string;
    sourceCandidateIntelligenceVersionId: string;
  }) => Promise<CompanyIntelligenceCompilationSource>;
  latestVersionNumber: (input: {
    workspaceId: string;
    organizationId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: CompanyIntelligence;
    sourceCandidateIntelligenceVersionId: string;
    versionNumber: number;
  }) => Promise<PersistedArtifact<CompanyIntelligence>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: CompanyIntelligenceServiceAdapters = {
  loadSource: loadCompilationSource,
  latestVersionNumber: loadLatestCompanyIntelligenceVersionNumber,
  persist: persistCompanyIntelligence,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistCompanyIntelligence(
  input: { workspaceId: string; sourceCandidateIntelligenceVersionId: string },
  adapters: CompanyIntelligenceServiceAdapters = productionAdapters,
) {
  const source = await adapters.loadSource(input);
  const artifact = compileCompanyIntelligence({
    artifactId: adapters.artifactId(),
    workspaceId: input.workspaceId,
    organization: source.organization,
    sourceCandidateIntelligenceVersionId: source.sourceCandidateIntelligenceVersionId,
    researchBlueprintVersionIds: source.researchBlueprintVersionIds,
    claims: source.claims,
    unresolvedQuestionKeys: source.unresolvedQuestionKeys,
    conflictKeys: source.conflictKeys,
    createdAt: adapters.now(),
  });
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    organizationId: source.organization.id,
  });
  return adapters.persist({
    artifact,
    sourceCandidateIntelligenceVersionId: source.sourceCandidateIntelligenceVersionId,
    versionNumber: latestVersion + 1,
  });
}

export async function ensureCompanyIntelligenceForCandidateSource(input: {
  workspaceId: string;
  sourceCandidateIntelligenceVersionId: string;
}) {
  const existing = await loadCompanyIntelligenceForCandidateSource(input);
  if (existing) return existing;
  try {
    return await compileAndPersistCompanyIntelligence(input);
  } catch (error) {
    if (error instanceof CompanyIntelligenceSourceIneligibleError) return null;
    throw error;
  }
}

async function loadCompilationSource(input: {
  workspaceId: string;
  sourceCandidateIntelligenceVersionId: string;
}): Promise<CompanyIntelligenceCompilationSource> {
  const supabase = createServiceRoleClient();
  const { data: version, error: versionError } = await supabase
    .from("candidate_intelligence_versions")
    .select("id,organization_id,compiled_snapshot_json")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.sourceCandidateIntelligenceVersionId)
    .single();
  if (versionError || !version) {
    throw new Error(
      `Could not load Candidate Intelligence source: ${versionError?.message ?? "missing row"}`,
    );
  }
  const snapshot = sourceSchema.parse(version.compiled_snapshot_json);
  if (snapshot.organizationId !== version.organization_id) {
    throw new Error("Candidate Intelligence source identity mismatch.");
  }
  const [
    { data: organization, error: organizationError },
    { data: primaryDomain, error: domainError },
    { data: plan, error: planError },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,website_url,identity_confidence,identity_review_state")
      .eq("workspace_id", input.workspaceId)
      .eq("id", version.organization_id)
      .single(),
    supabase
      .from("company_domains")
      .select("normalized_domain")
      .eq("workspace_id", input.workspaceId)
      .eq("company_id", version.organization_id)
      .eq("is_primary", true)
      .maybeSingle(),
    supabase
      .from("candidate_research_plans")
      .select("campaign_candidate_id")
      .eq("workspace_id", input.workspaceId)
      .eq("id", snapshot.researchPlanId)
      .single(),
  ]);
  if (organizationError || !organization) {
    throw new Error(
      `Could not load Company Intelligence organization: ${organizationError?.message ?? "missing row"}`,
    );
  }
  if (domainError) {
    throw new Error(`Could not load Company Intelligence domain: ${domainError.message}`);
  }
  if (planError || !plan) {
    throw new Error(
      `Could not load Company Intelligence research plan: ${planError?.message ?? "missing row"}`,
    );
  }
  if (!plan.campaign_candidate_id) {
    throw new CompanyIntelligenceSourceIneligibleError(
      "Candidate Intelligence has no Campaign Candidate provenance.",
    );
  }
  const { data: campaignCandidate, error: candidateError } = await supabase
    .from("campaign_candidates")
    .select("campaign_id,matched_archetype_ids_json")
    .eq("workspace_id", input.workspaceId)
    .eq("id", plan.campaign_candidate_id)
    .single();
  if (candidateError || !campaignCandidate) {
    throw new Error(
      `Could not load Company Intelligence Campaign Candidate: ${candidateError?.message ?? "missing row"}`,
    );
  }
  const matchedArchetypeIds = z
    .array(z.string().min(1))
    .parse(campaignCandidate.matched_archetype_ids_json);
  if (!matchedArchetypeIds.length) {
    throw new CompanyIntelligenceSourceIneligibleError(
      "Candidate Intelligence has no matched Research Blueprint provenance.",
    );
  }
  const { data: blueprints, error: blueprintError } = await supabase
    .from("research_blueprint_versions_v2")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaignCandidate.campaign_id)
    .in("target_archetype_id", matchedArchetypeIds);
  if (blueprintError) {
    throw new Error(`Could not load Company Intelligence blueprints: ${blueprintError.message}`);
  }
  const researchBlueprintVersionIds = (blueprints ?? []).map(({ id }) => id);
  if (!researchBlueprintVersionIds.length) {
    throw new CompanyIntelligenceSourceIneligibleError(
      "Candidate Intelligence has no frozen Research Blueprint versions.",
    );
  }
  return {
    sourceCandidateIntelligenceVersionId: version.id,
    organization: {
      id: organization.id,
      canonicalName: organization.name,
      aliases: [],
      officialDomain: primaryDomain?.normalized_domain ?? null,
      officialWebsite:
        organization.website_url ??
        (primaryDomain ? `https://${primaryDomain.normalized_domain}/` : null),
      identityConfidence: organization.identity_confidence ?? 0,
      identityReviewState: normalizeIdentityState(organization.identity_review_state),
    },
    researchBlueprintVersionIds,
    claims: snapshot.claims,
    unresolvedQuestionKeys: snapshot.unresolvedQuestionKeys,
    conflictKeys: snapshot.conflictKeys,
  };
}

function normalizeIdentityState(value: string) {
  if (value === "resolved" || value === "merged") return "confirmed" as const;
  if (value === "needs_review") return "unresolved" as const;
  if (value === "conflicting") return "conflicting" as const;
  if (value === "invalid") return "invalid" as const;
  return "probable" as const;
}

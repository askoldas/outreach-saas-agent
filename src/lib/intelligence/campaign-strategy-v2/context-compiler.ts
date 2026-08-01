import { createHash } from "node:crypto";
import type { IntelligenceClaim } from "../contracts/claims.ts";
import type { IntelligenceRule } from "../contracts/rules.ts";
import type {
  CampaignGeographyV2,
  CampaignObjectiveV2,
  CampaignOfferingReferenceV2,
} from "./schemas.ts";

export const campaignContextCompilerVersion = "campaign-context/v2.1-native";

export type CampaignProfileContextSource = {
  workspaceId: string;
  profileVersionId: string;
  offeringReferences: CampaignOfferingReferenceV2[];
  objective: CampaignObjectiveV2;
  geography: CampaignGeographyV2;
  companyRoles: string[];
  offerings: Array<{
    offeringVersionId: string;
    summary: string;
    valueDelivered: string[];
    transactionModels: string[];
    buyerUseModes: string[];
  }>;
  buyerHypotheses: Array<{
    offeringVersionId: string;
    relationshipType: string;
    summary: string;
  }>;
  rules: IntelligenceRule[];
  claims: IntelligenceClaim[];
};

export type CompiledCampaignCommercialContext = {
  compilerVersion: typeof campaignContextCompilerVersion;
  workspaceId: string;
  profileVersionId: string;
  offeringVersionIds: string[];
  companyRoles: string[];
  offeringSummary: string;
  valueDelivered: string[];
  transactionModels: string[];
  buyerUseModes: string[];
  reusableBuyerHypotheses: CampaignProfileContextSource["buyerHypotheses"];
  applicableProfileRules: IntelligenceRule[];
  applicableOfferingRules: IntelligenceRule[];
  confirmedFacts: IntelligenceClaim[];
  relevantHypotheses: IntelligenceClaim[];
  unresolvedHighImpactQuestions: IntelligenceClaim[];
  contextHash: string;
};

export function compileCampaignCommercialContext(
  source: CampaignProfileContextSource,
): CompiledCampaignCommercialContext {
  const offeringVersionIds = unique(
    source.offeringReferences.map((reference) => reference.offeringVersionId),
  ).sort();
  if (
    source.offeringReferences.some(
      (reference) => reference.companyProfileVersionId !== source.profileVersionId,
    )
  ) {
    throw new Error("Campaign offering references cross the frozen profile boundary.");
  }
  const selected = source.offerings.filter((offering) =>
    offeringVersionIds.includes(offering.offeringVersionId),
  );
  if (selected.length !== offeringVersionIds.length) {
    throw new Error("One or more selected offering versions are unavailable.");
  }
  const ruleApplies = (rule: IntelligenceRule) => {
    const applicability = rule.applicability;
    return (
      matches(applicability.objectives, source.objective.code) &&
      matchesAny(applicability.offeringIds, offeringVersionIds) &&
      matchesAny(applicability.geographies, source.geography.countryCodes) &&
      matchesAny(
        applicability.relationshipTypes,
        source.objective.targetRelationshipTypes,
      )
    );
  };
  const rules = source.rules
    .filter(
      (rule) =>
        rule.status === "confirmed" &&
        ["workspace", "offering"].includes(rule.scope) &&
        ruleApplies(rule),
    )
    .sort((left, right) => left.ruleKey.localeCompare(right.ruleKey));
  const claims = source.claims.filter((claim) => {
    const path = claim.fieldPath.toLowerCase();
    return (
      offeringVersionIds.some((id) => path.includes(id.toLowerCase())) ||
      path.includes("company") ||
      path.includes("commercial") ||
      path.includes("buyer")
    );
  });
  const withoutHash = {
    compilerVersion:
      campaignContextCompilerVersion as typeof campaignContextCompilerVersion,
    workspaceId: source.workspaceId,
    profileVersionId: source.profileVersionId,
    offeringVersionIds,
    companyRoles: unique(source.companyRoles).sort(),
    offeringSummary: selected.map((offering) => offering.summary).join("\n"),
    valueDelivered: unique(
      selected.flatMap((offering) => offering.valueDelivered),
    ).sort(),
    transactionModels: unique(
      selected.flatMap((offering) => offering.transactionModels),
    ).sort(),
    buyerUseModes: unique(selected.flatMap((offering) => offering.buyerUseModes)).sort(),
    reusableBuyerHypotheses: source.buyerHypotheses
      .filter(
        (hypothesis) =>
          offeringVersionIds.includes(hypothesis.offeringVersionId) &&
          source.objective.targetRelationshipTypes.includes(
            hypothesis.relationshipType as never,
          ),
      )
      .sort((left, right) => left.summary.localeCompare(right.summary)),
    applicableProfileRules: rules.filter((rule) => rule.scope === "workspace"),
    applicableOfferingRules: rules.filter((rule) => rule.scope === "offering"),
    confirmedFacts: claims
      .filter((claim) => claim.epistemicStatus === "explicit_fact")
      .sort(byClaimId),
    relevantHypotheses: claims
      .filter((claim) =>
        ["evidence_backed_inference", "hypothesis"].includes(claim.epistemicStatus),
      )
      .sort(byClaimId),
    unresolvedHighImpactQuestions: claims
      .filter((claim) => ["unknown", "conflict"].includes(claim.epistemicStatus))
      .sort(byClaimId),
  };
  return { ...withoutHash, contextHash: hashCanonical(withoutHash) };
}

export function hashCanonical(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function matches(values: string[], selected: string) {
  return values.length === 0 || values.includes(selected);
}

function matchesAny(values: string[], selected: string[]) {
  return values.length === 0 || values.some((value) => selected.includes(value));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function byClaimId(left: IntelligenceClaim, right: IntelligenceClaim) {
  return left.claimId.localeCompare(right.claimId);
}

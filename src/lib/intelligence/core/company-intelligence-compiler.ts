import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import {
  companyIntelligenceSchema,
  type CompanyIntelligence,
} from "./company-intelligence.ts";
import {
  commercialRelationshipTypeSchema,
  type CommercialRelationshipType,
} from "./commercial-intelligence.ts";

export const COMPANY_INTELLIGENCE_SCHEMA_VERSION = "company-intelligence/v1";
export const COMPANY_INTELLIGENCE_COMPILER_VERSION =
  "reusable-research-company-intelligence-compiler/v1";

export type ReusableResearchClaim = {
  id: string;
  key: string;
  fieldPath: string;
  statement: string;
  value?: unknown;
  status:
    | "confirmed_fact"
    | "evidence_backed_inference"
    | "hypothesis"
    | "unknown"
    | "conflicting";
  confidence: number;
  evidenceIds: string[];
  reusableScope?: "organization" | "offering_context" | "campaign_only";
};

export function compileCompanyIntelligence(input: {
  artifactId: string;
  workspaceId: string;
  organization: {
    id: string;
    canonicalName: string;
    aliases?: string[];
    officialDomain: string | null;
    officialWebsite: string | null;
    identityConfidence: number;
    identityReviewState: CompanyIntelligence["identity"]["identityReviewState"];
  };
  sourceCandidateIntelligenceVersionId: string;
  researchBlueprintVersionIds: string[];
  claims: ReusableResearchClaim[];
  unresolvedQuestionKeys: string[];
  conflictKeys: string[];
  createdAt: string;
}): CompanyIntelligence {
  if (!input.researchBlueprintVersionIds.length) {
    throw new Error("Company Intelligence requires a frozen Research Blueprint.");
  }
  const claims = input.claims
    .filter(({ reusableScope }) => (reusableScope ?? "organization") === "organization")
    .sort((a, b) => a.fieldPath.localeCompare(b.fieldPath) || a.id.localeCompare(b.id));
  const usable = claims.filter(({ status }) =>
    ["confirmed_fact", "evidence_backed_inference"].includes(status),
  );
  const evidenceIds = uniqueSorted(claims.flatMap((claim) => claim.evidenceIds));
  const blueprintIds = uniqueSorted(input.researchBlueprintVersionIds);
  const body = {
    workspaceId: input.workspaceId,
    organizationId: input.organization.id,
    identity: {
      canonicalName: input.organization.canonicalName,
      aliases: uniqueSorted(input.organization.aliases ?? []),
      officialDomain: input.organization.officialDomain,
      officialWebsite: input.organization.officialWebsite,
      identityConfidence: input.organization.identityConfidence,
      identityReviewState: input.organization.identityReviewState,
    },
    businessModel: valuesFor(usable, ["business_model"]),
    organizationRoles: relationshipValues(usable),
    industries: valuesFor(usable, ["industry", "industries"]),
    productsServices: valuesFor(usable, ["products_services"]),
    operations: valuesFor(usable, ["operations"]),
    operatingGeographies: valuesFor(usable, ["operating_markets"]),
    scale: valuesFor(usable, ["scale"]),
    locations: valuesFor(usable, ["locations"]),
    facilities: valuesFor(usable, ["facilities"]),
    customerTypes: valuesFor(usable, ["customer_types"]),
    operationalCharacteristics: valuesForPrefix(usable, "operational_need."),
    offeringUseCompatibility: [],
    procurementCharacteristics: valuesFor(usable, ["procurement_characteristics"]),
    relevantCapabilities: valuesFor(usable, ["relevant_capabilities"]),
    positiveSignals: [],
    negativeSignals: [],
    contradictions: uniqueSorted(
      claims
        .filter(({ status }) => status === "conflicting")
        .map(({ statement }) => statement),
    ),
    unknowns: uniqueSorted(input.unresolvedQuestionKeys).map((key) => ({
      key,
      question: `Research remains unresolved for ${key.replaceAll("_", " ")}.`,
      importance: "important" as const,
    })),
    claims: claims.map((claim) => ({
      claimId: claim.id,
      fieldPath: claim.fieldPath,
      statement: claim.statement,
      ...(claim.value === undefined || claim.status === "unknown"
        ? {}
        : { value: claim.value }),
      epistemicStatus: status(claim.status),
      confidence: claim.status === "unknown" ? 0 : claim.confidence,
      evidenceIds: uniqueSorted(claim.evidenceIds),
      counterEvidenceIds: [],
      ...(claim.status === "evidence_backed_inference" || claim.status === "conflicting"
        ? { conciseRationale: claim.statement }
        : {}),
    })),
    evidenceIds,
    researchBlueprintVersionIds: blueprintIds,
    confidence: confidence(claims, input.organization.identityConfidence),
  };
  return companyIntelligenceSchema.parse({
    id: input.artifactId,
    ...body,
    version: {
      schemaVersion: COMPANY_INTELLIGENCE_SCHEMA_VERSION,
      compilerVersion: COMPANY_INTELLIGENCE_COMPILER_VERSION,
      inputHash: hashCanonical({
        sourceCandidateIntelligenceVersionId: input.sourceCandidateIntelligenceVersionId,
        researchBlueprintVersionIds: blueprintIds,
        organizationId: input.organization.id,
        compilerVersion: COMPANY_INTELLIGENCE_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
    },
  });
}

function valuesFor(claims: ReusableResearchClaim[], keys: string[]) {
  const accepted = new Set(keys);
  return uniqueSorted(claims.filter(({ key }) => accepted.has(key)).flatMap(claimValues));
}

function valuesForPrefix(claims: ReusableResearchClaim[], prefix: string) {
  return uniqueSorted(
    claims.filter(({ key }) => key.startsWith(prefix)).flatMap(claimValues),
  );
}

function relationshipValues(claims: ReusableResearchClaim[]) {
  const candidates = valuesFor(claims, ["organization_roles", "business_roles", "roles"]);
  return uniqueSorted(
    candidates.flatMap((value) => {
      const parsed = commercialRelationshipTypeSchema.safeParse(
        value
          .trim()
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "_"),
      );
      return parsed.success ? [parsed.data] : [];
    }),
  ) as CommercialRelationshipType[];
}

function claimValues(claim: ReusableResearchClaim) {
  if (Array.isArray(claim.value))
    return claim.value.filter(
      (value): value is string => typeof value === "string" && Boolean(value.trim()),
    );
  if (typeof claim.value === "string" && claim.value.trim()) return [claim.value.trim()];
  return [claim.statement];
}

function status(value: ReusableResearchClaim["status"]) {
  if (value === "confirmed_fact") return "explicit_fact" as const;
  if (value === "conflicting") return "conflict" as const;
  return value;
}

function confidence(claims: ReusableResearchClaim[], identityConfidence: number) {
  const supported = claims.filter(({ status }) =>
    ["confirmed_fact", "evidence_backed_inference"].includes(status),
  );
  if (!supported.length) return Math.min(identityConfidence, 0.3);
  return Math.min(
    identityConfidence,
    supported.reduce((sum, claim) => sum + claim.confidence, 0) / supported.length,
  );
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

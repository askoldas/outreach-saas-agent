import {
  normalizeCanonicalUrl,
  normalizeCountry,
  normalizeDomain,
  normalizeOrganizationName,
  type ExternalOrganizationType,
} from "../../lib/entity-resolution-v2/index.ts";

export const ENTITY_RESOLUTION_RUNTIME_RULES_VERSION = "entity-resolution-v2.2";

const organizationWebsitePageTypes = new Set(["company_homepage", "company_subpage"]);

export type CampaignResolutionInput = {
  canonicalDomainHint: string | null;
  country: string | null;
  matchedArchetypeKey: string;
  matchedSegmentKey: string;
  name: string;
  normalizedCandidateId: string;
  normalizedName: string | null;
  organizationTypeHint: string | null;
  preliminaryQuality: unknown;
  providerSourceRecordId: string;
  sourcePageType: string | null;
  sourceUrl: string | null;
  websiteUrl: string | null;
};

export type PreparedResolutionCandidate = {
  canonicalDomain: string | null;
  canonicalUrl: string | null;
  confidence: number;
  country: string | null;
  groupKey: string;
  groupingBasis: "domain" | "name_country" | "name" | "candidate";
  invalidIdentity: boolean;
  matchedArchetypeKey: string;
  matchedSegmentKey: string;
  name: string;
  normalizedCandidateId: string;
  normalizedName: string;
  organizationType: ExternalOrganizationType;
  providerSourceRecordId: string;
  safeOfficialDomain: boolean;
};

export function prepareResolutionCandidate(
  input: CampaignResolutionInput,
): PreparedResolutionCandidate {
  const normalizedNameFromName = normalizeOrganizationName(
    input.normalizedName?.trim() || input.name,
  );
  const country = normalizeCountry(input.country ?? undefined) ?? null;
  const domain = normalizeDomain(input.canonicalDomainHint ?? undefined) ?? null;
  const sourceDomain = normalizeDomain(input.sourceUrl ?? undefined);
  const websiteDomain = normalizeDomain(input.websiteUrl ?? undefined);
  const attributableWebsiteDomain =
    domain !== null &&
    organizationWebsitePageTypes.has(input.sourcePageType ?? "") &&
    sourceDomain === domain &&
    websiteDomain === domain;
  const safeOfficialDomain =
    attributableWebsiteDomain && input.sourcePageType === "company_homepage";
  const canonicalDomain = safeOfficialDomain ? domain : null;
  const normalizedName =
    normalizedNameFromName ||
    (canonicalDomain ? canonicalDomain.replace(/[^\p{Letter}\p{Number}]+/gu, " ") : "");
  const canonicalUrl = canonicalDomain
    ? (normalizeCanonicalUrl(`https://${canonicalDomain}/`) ?? null)
    : null;
  const organizationType = mapOrganizationType(input.organizationTypeHint);
  const confidence = preliminaryConfidence(input.preliminaryQuality);
  const grouping = groupIdentity({
    groupingDomain: attributableWebsiteDomain ? domain : null,
    country,
    normalizedCandidateId: input.normalizedCandidateId,
    normalizedName,
  });

  return {
    canonicalDomain,
    canonicalUrl,
    confidence,
    country,
    ...grouping,
    invalidIdentity:
      input.organizationTypeHint === "directory_listing" ||
      (!normalizedName && !canonicalDomain),
    matchedArchetypeKey: input.matchedArchetypeKey,
    matchedSegmentKey: input.matchedSegmentKey,
    name: input.name.trim(),
    normalizedCandidateId: input.normalizedCandidateId,
    normalizedName,
    organizationType,
    providerSourceRecordId: input.providerSourceRecordId,
    safeOfficialDomain,
  };
}

export function prepareResolutionCandidates(
  inputs: CampaignResolutionInput[],
): PreparedResolutionCandidate[] {
  return inputs
    .map(prepareResolutionCandidate)
    .sort((left, right) =>
      left.normalizedCandidateId.localeCompare(right.normalizedCandidateId),
    );
}

function groupIdentity(input: {
  groupingDomain: string | null;
  country: string | null;
  normalizedCandidateId: string;
  normalizedName: string;
}): Pick<PreparedResolutionCandidate, "groupKey" | "groupingBasis"> {
  if (input.groupingDomain) {
    return {
      groupKey: `domain:${input.groupingDomain}`,
      groupingBasis: "domain",
    };
  }
  if (input.normalizedName && input.country) {
    return {
      groupKey: `name_country:${input.normalizedName}:${input.country}`,
      groupingBasis: "name_country",
    };
  }
  if (input.normalizedName) {
    return {
      groupKey: `name:${input.normalizedName}`,
      groupingBasis: "name",
    };
  }
  return {
    groupKey: `candidate:${input.normalizedCandidateId}`,
    groupingBasis: "candidate",
  };
}

function mapOrganizationType(value: string | null): ExternalOrganizationType {
  const mapped: Record<string, ExternalOrganizationType> = {
    company: "operating_company",
    brand: "brand",
    branch: "branch",
    storefront: "storefront",
    legal_entity: "legal_entity",
    marketplace_seller: "marketplace_seller",
  };
  return mapped[value ?? ""] ?? "unknown";
}

function preliminaryConfidence(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const confidence = Number((value as Record<string, unknown>).confidence);
  return Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
}

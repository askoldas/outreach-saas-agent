import type {
  EntityMatchAssessment,
  ExternalOrganizationType,
  OrganizationIdentity,
  ResolutionCandidate,
  ResolutionOutcome,
} from "./contracts.ts";
import {
  normalizeCanonicalUrl,
  normalizeCountry,
  normalizeDomain,
  normalizeLegalIdentifier,
  normalizeOrganizationName,
} from "./normalization.ts";

export const ENTITY_RESOLUTION_RULES_VERSION = "entity-resolution-v2.1";

const incompatibleTypes = new Set([
  "brand:franchisee",
  "franchisee:brand",
  "marketplace:marketplace_seller",
  "marketplace_seller:marketplace",
]);

function typesConflict(left: ExternalOrganizationType, right: ExternalOrganizationType) {
  return incompatibleTypes.has(`${left}:${right}`);
}

export function assessOrganizationMatch(
  candidate: ResolutionCandidate,
  organization: OrganizationIdentity,
): EntityMatchAssessment {
  const signals: EntityMatchAssessment["signals"] = [];
  const candidateName = normalizeOrganizationName(
    candidate.normalizedName ?? candidate.name,
  );
  const countryMatches =
    normalizeCountry(candidate.country) !== undefined &&
    normalizeCountry(candidate.country) === normalizeCountry(organization.primaryCountry);
  const typeConflict = typesConflict(
    candidate.organizationType,
    organization.organizationType,
  );

  const candidateLegalIds = (candidate.legalIdentifiers ?? []).filter(
    (item) => item.verified,
  );
  const legalMatch = candidateLegalIds.some((candidateId) =>
    organization.legalIdentifiers.some(
      (knownId) =>
        knownId.verified &&
        knownId.type === candidateId.type &&
        normalizeCountry(knownId.jurisdiction) ===
          normalizeCountry(candidateId.jurisdiction) &&
        normalizeLegalIdentifier(knownId.value) ===
          normalizeLegalIdentifier(candidateId.value),
    ),
  );
  if (legalMatch) {
    signals.push({
      key: "verified_legal_identifier",
      category: "legal_identifier",
      state: "match",
      weight: 1,
      confidence: 1,
      evidenceIds: [],
      explanation: "A verified legal identifier matches in the same jurisdiction.",
    });
  }

  const candidateDomain = normalizeDomain(candidate.domain);
  const domainMatch =
    !candidate.sharedDirectoryDomain &&
    candidateDomain !== undefined &&
    organization.domains.some((domain) => normalizeDomain(domain) === candidateDomain);
  if (domainMatch) {
    signals.push({
      key: "canonical_domain",
      category: "domain",
      state: "match",
      weight: 0.95,
      confidence: 0.98,
      evidenceIds: [],
      explanation:
        "The canonical domain matches and is not marked as a shared directory.",
    });
  }

  const candidateUrl = normalizeCanonicalUrl(candidate.canonicalUrl);
  const urlMatch =
    candidateUrl !== undefined &&
    organization.canonicalUrls.some((url) => normalizeCanonicalUrl(url) === candidateUrl);
  if (urlMatch) {
    signals.push({
      key: "canonical_url",
      category: "redirect",
      state: "match",
      weight: 0.9,
      confidence: 0.98,
      evidenceIds: [],
      explanation: "The canonical URL matches exactly.",
    });
  }

  const nameMatch =
    candidateName.length > 0 &&
    candidateName === normalizeOrganizationName(organization.normalizedName);
  const nameAndCountryMatch = nameMatch && countryMatches;
  if (nameAndCountryMatch) {
    signals.push({
      key: "normalized_name_country",
      category: "name",
      state: "match",
      weight: 0.55,
      confidence: 0.8,
      evidenceIds: [],
      explanation:
        "Normalized name and country match; this is not sufficient to auto-link.",
    });
  } else if (nameMatch) {
    signals.push({
      key: "normalized_name",
      category: "name",
      state: "partial_match",
      weight: 0.35,
      confidence: 0.65,
      evidenceIds: [],
      explanation: "A normalized-name match without country evidence requires review.",
    });
  }
  if (typeConflict) {
    signals.push({
      key: "incompatible_entity_types",
      category: "contradiction",
      state: "conflict",
      weight: 1,
      confidence: 1,
      evidenceIds: [],
      explanation:
        "Entity types must remain distinct unless a graph relationship is established.",
    });
  }

  const deterministicMatch = legalMatch || domainMatch || urlMatch;
  const recommendation = typeConflict
    ? "link_as_related_entity"
    : deterministicMatch
      ? "auto_link"
      : nameMatch
        ? "needs_review"
        : "create_new";

  return {
    normalizedCandidateId: candidate.normalizedCandidateId,
    existingOrganizationId: organization.organizationId,
    signals,
    aggregateConfidence: typeConflict
      ? 0
      : legalMatch
        ? 1
        : domainMatch || urlMatch
          ? 0.98
          : nameMatch
            ? 0.8
            : 0,
    contradictionSeverity: typeConflict ? "high" : "none",
    recommendation,
    reasoningSummary: typeConflict
      ? "A related graph node may be appropriate, but these entity types must not be merged."
      : deterministicMatch
        ? "A deterministic exact identity signal supports linking."
        : nameMatch
          ? "A name match requires country or stronger identity evidence."
          : "No reliable identity match was found.",
    rulesVersion: ENTITY_RESOLUTION_RULES_VERSION,
  };
}

export function resolveOrganization(
  candidate: ResolutionCandidate,
  organizations: OrganizationIdentity[],
): ResolutionOutcome {
  const assessments = organizations
    .map((organization) => assessOrganizationMatch(candidate, organization))
    .sort((left, right) => right.aggregateConfidence - left.aggregateConfidence);
  const automatic = assessments.filter(
    (assessment) => assessment.recommendation === "auto_link",
  );
  const soleAutomatic = automatic[0];
  if (soleAutomatic && automatic.length === 1) {
    return { action: "link_existing", assessment: soleAutomatic };
  }
  if (
    automatic.length > 1 ||
    assessments.some((assessment) =>
      ["needs_review", "link_as_related_entity"].includes(assessment.recommendation),
    )
  ) {
    return { action: "needs_review", assessments };
  }
  return { action: "create_new", assessments };
}

export const RELATIONSHIP_SUPPRESSION_POLICY_VERSION =
  "pre-research-relationship-suppression-v1";

export type SuppressionRelationship =
  | "existing_customer"
  | "former_customer"
  | "competitor"
  | "partner"
  | "excluded";

export type RelationshipSuppressionEntry = {
  organizationId?: string;
  canonicalDomains: string[];
  normalizedNames: string[];
  relationship: SuppressionRelationship;
  status: "confirmed" | "probable" | "ambiguous";
  confidence: number;
  evidenceIds: string[];
  source: "user_exclusion" | "prior_qualification" | "relationship_memory";
};

export type RelationshipSuppressionMatch = {
  decision: "continue" | "hold" | "suppress";
  reason?:
    | "existing_customer"
    | "competitor"
    | "explicit_exclusion"
    | "relationship_requires_verification";
  relationship?: SuppressionRelationship;
  matchedBy?: "organization_id" | "canonical_domain" | "normalized_name";
  confidence?: number;
  evidenceIds: string[];
  policyVersion: typeof RELATIONSHIP_SUPPRESSION_POLICY_VERSION;
};

export function matchRelationshipSuppression(input: {
  candidate: {
    organizationId: string;
    canonicalDomain: string | null;
    organizationName: string;
  };
  entries: RelationshipSuppressionEntry[];
}): RelationshipSuppressionMatch {
  const base: RelationshipSuppressionMatch = {
    decision: "continue" as const,
    evidenceIds: [],
    policyVersion: RELATIONSHIP_SUPPRESSION_POLICY_VERSION,
  };
  const normalizedDomain = normalizeDomain(input.candidate.canonicalDomain);
  const normalizedName = normalizeName(input.candidate.organizationName);
  const matches: Array<{
    entry: RelationshipSuppressionEntry;
    matchedBy: "organization_id" | "canonical_domain" | "normalized_name";
  }> = [];
  for (const entry of input.entries) {
    if (entry.organizationId === input.candidate.organizationId) {
      matches.push({ entry, matchedBy: "organization_id" });
      continue;
    }
    if (
      normalizedDomain &&
      entry.canonicalDomains.some(
        (domain) => normalizeDomain(domain) === normalizedDomain,
      )
    ) {
      matches.push({ entry, matchedBy: "canonical_domain" });
      continue;
    }
    if (
      normalizedName &&
      entry.confidence >= 0.95 &&
      entry.normalizedNames.some((name) => normalizeName(name) === normalizedName)
    ) {
      matches.push({ entry, matchedBy: "normalized_name" });
    }
  }
  if (!matches.length) return base;
  const strongest = matches.sort(
    (left, right) =>
      matchStrength(right.matchedBy) - matchStrength(left.matchedBy) ||
      right.entry.confidence - left.entry.confidence,
  )[0]!;
  const confirmed =
    strongest.entry.status === "confirmed" &&
    strongest.entry.confidence >= 0.8 &&
    (strongest.entry.source === "user_exclusion" ||
      strongest.entry.evidenceIds.length > 0);
  if (
    confirmed &&
    ["existing_customer", "competitor", "excluded"].includes(strongest.entry.relationship)
  ) {
    return {
      decision: "suppress",
      reason:
        strongest.entry.relationship === "existing_customer"
          ? "existing_customer"
          : strongest.entry.relationship === "competitor"
            ? "competitor"
            : "explicit_exclusion",
      relationship: strongest.entry.relationship,
      matchedBy: strongest.matchedBy,
      confidence: strongest.entry.confidence,
      evidenceIds: [...new Set(strongest.entry.evidenceIds)].sort(),
      policyVersion: RELATIONSHIP_SUPPRESSION_POLICY_VERSION,
    };
  }
  return {
    decision: "hold",
    reason: "relationship_requires_verification",
    relationship: strongest.entry.relationship,
    matchedBy: strongest.matchedBy,
    confidence: strongest.entry.confidence,
    evidenceIds: [...new Set(strongest.entry.evidenceIds)].sort(),
    policyVersion: RELATIONSHIP_SUPPRESSION_POLICY_VERSION,
  };
}

function matchStrength(
  value: "organization_id" | "canonical_domain" | "normalized_name",
) {
  return value === "organization_id" ? 3 : value === "canonical_domain" ? 2 : 1;
}

function normalizeDomain(value: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

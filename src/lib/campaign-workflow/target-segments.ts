import type { ProfileConfidence } from "../company-profile/structured-profile.ts";

export const b2bRelationshipTypes = [
  "customer",
  "partner",
  "distributor",
  "reseller",
  "supplier",
  "contractor",
  "public_institution",
] as const;

export type B2BRelationshipType = (typeof b2bRelationshipTypes)[number];
export type TargetSegmentStatus = "suggested" | "confirmed" | "low_priority" | "rejected";
export type TargetSegmentSource =
  | "ai_suggested"
  | "user_added"
  | "ai_interpreted"
  | "saved_template";

export type TargetSegment = {
  id: string;
  name: string;
  summary: string;
  relationshipType: B2BRelationshipType;
  organizationTypes: string[];
  industries: string[];
  companySize?: { minimumEmployees?: number; maximumEmployees?: number };
  geographies: string[];
  characteristics: string[];
  buyingSignals: string[];
  likelyBuyerRoles: string[];
  exclusions: string[];
  rationale: string;
  supportingEvidence: string[];
  discoverability: "high" | "medium" | "low";
  source: TargetSegmentSource;
  confidence: ProfileConfidence;
  status: TargetSegmentStatus;
};

const consumerOnlyTerms = [
  "consumer",
  "consumers",
  "family",
  "families",
  "individual",
  "individuals",
  "people",
  "private customer",
  "private customers",
  "household",
  "households",
];

const genericOrganizationLabels = new Set([
  "business",
  "businesses",
  "buyer",
  "buyers",
  "company",
  "companies",
  "customer",
  "customers",
  "organization",
  "organizations",
  "partner",
  "partners",
  "target companies",
  "target organizations",
]);

export function parseTargetSegments(value: unknown): TargetSegment[] {
  if (!Array.isArray(value)) {
    throw new Error("Campaign proposal returned invalid target segments.");
  }
  const segments = value.map(parseTargetSegment);
  if (segments.length < 1 || segments.length > 5) {
    throw new Error("Campaign proposal must contain between one and five targets.");
  }
  const ids = new Set(segments.map((segment) => segment.id));
  if (ids.size !== segments.length) {
    throw new Error("Campaign proposal returned duplicate target segment IDs.");
  }
  return segments;
}

export function assessCampaignTargetDiscoverability(
  segment: Pick<
    TargetSegment,
    | "organizationTypes"
    | "industries"
    | "companySize"
    | "geographies"
    | "characteristics"
    | "buyingSignals"
  >,
): TargetSegment["discoverability"] {
  const organizationTypes = segment.organizationTypes.map(normalize).filter(Boolean);
  if (!organizationTypes.length || organizationTypes.every(isConsumerOnlyLabel)) {
    return "low";
  }

  const hasSpecificOrganizationType = organizationTypes.some(isSpecificOrganizationLabel);
  const hasCompanySize = Boolean(
    segment.companySize?.minimumEmployees || segment.companySize?.maximumEmployees,
  );
  const score =
    (hasSpecificOrganizationType ? 2 : 0) +
    (segment.industries.some(hasText) ? 1 : 0) +
    (segment.characteristics.some(hasText) ? 1 : 0) +
    (segment.buyingSignals.some(hasText) ? 1 : 0) +
    (segment.geographies.some(hasText) ? 1 : 0) +
    (hasCompanySize ? 1 : 0);

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

export function assertCampaignTargetIsDiscoverable(segment: TargetSegment) {
  if (!b2bRelationshipTypes.includes(segment.relationshipType)) {
    throw new Error("Every Campaign target requires a B2B relationship type.");
  }
  if (!segment.organizationTypes.length) {
    throw new Error("Every Campaign target must identify an organization type.");
  }
  if (segment.organizationTypes.every(isConsumerOnlyLabel)) {
    throw new Error(
      "Opptium discovers organizations rather than individual consumers. Choose the companies, institutions or partners that could purchase, distribute or support this Offering.",
    );
  }
  if (
    segment.industries.length === 1 &&
    segment.industries[0]?.trim().toLowerCase() === "consumer"
  ) {
    throw new Error("Consumer alone cannot be a Campaign target industry.");
  }
  if (
    assessCampaignTargetDiscoverability(segment) === "low" &&
    segment.status === "confirmed"
  ) {
    throw new Error("A confirmed Campaign target must be searchable.");
  }
}

export function isConsumerOnlyLabel(value: string) {
  const normalized = normalize(value);
  return consumerOnlyTerms.some(
    (term) => normalized === term || normalized.startsWith(`${term} `),
  );
}

function parseTargetSegment(value: unknown): TargetSegment {
  const row = record(value, "target segment");
  const relationshipType = text(row.relationshipType, "relationshipType");
  if (!b2bRelationshipTypes.includes(relationshipType as B2BRelationshipType)) {
    throw new Error("Campaign proposal returned invalid relationshipType.");
  }
  const companySize =
    row.companySize === undefined ? undefined : record(row.companySize, "companySize");
  const minimumEmployees = optionalInteger(companySize?.minimumEmployees);
  const maximumEmployees = optionalInteger(companySize?.maximumEmployees);
  if (
    minimumEmployees !== undefined &&
    maximumEmployees !== undefined &&
    minimumEmployees > maximumEmployees
  ) {
    throw new Error("Campaign proposal returned an invalid company size.");
  }
  const segment: TargetSegment = {
    id: text(row.id, "id"),
    name: text(row.name, "name"),
    summary: text(row.summary, "summary"),
    relationshipType: relationshipType as B2BRelationshipType,
    organizationTypes: strings(row.organizationTypes, "organizationTypes"),
    industries: strings(row.industries, "industries"),
    ...(companySize
      ? {
          companySize: {
            ...(minimumEmployees !== undefined ? { minimumEmployees } : {}),
            ...(maximumEmployees !== undefined ? { maximumEmployees } : {}),
          },
        }
      : {}),
    geographies: strings(row.geographies, "geographies"),
    characteristics: strings(row.characteristics, "characteristics"),
    buyingSignals: strings(row.buyingSignals, "buyingSignals"),
    likelyBuyerRoles: strings(row.likelyBuyerRoles, "likelyBuyerRoles"),
    exclusions: strings(row.exclusions, "exclusions"),
    rationale: text(row.rationale, "rationale"),
    supportingEvidence: strings(row.supportingEvidence, "supportingEvidence"),
    discoverability: enumeration(
      row.discoverability,
      ["high", "medium", "low"],
      "discoverability",
    ),
    source: enumeration(
      row.source,
      ["ai_suggested", "user_added", "ai_interpreted", "saved_template"],
      "source",
    ),
    confidence: enumeration(row.confidence, ["high", "medium", "low"], "confidence"),
    status: enumeration(
      row.status,
      ["suggested", "confirmed", "low_priority", "rejected"],
      "status",
    ),
  };
  const normalizedSegment: TargetSegment = {
    ...segment,
    discoverability: assessCampaignTargetDiscoverability(segment),
  };
  assertCampaignTargetIsDiscoverable(normalizedSegment);
  return normalizedSegment;
}

function isSpecificOrganizationLabel(value: string) {
  if (genericOrganizationLabels.has(value)) return false;
  return !/^(organizations?|companies|businesses) (commercially compatible|that could|interested in|relevant to|for the selected)/.test(
    value,
  );
}

function hasText(value: string) {
  return Boolean(value.trim());
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value.trim();
}

function strings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function optionalInteger(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1_000_000) {
    throw new Error("Campaign proposal returned an invalid employee bound.");
  }
  return parsed;
}

function enumeration<const T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`Campaign proposal returned invalid ${field}.`);
  }
  return value as T;
}

import type { ProfileConfidence } from "../company-profile/structured-profile.ts";

export type OfferingStatus =
  | "suggested"
  | "confirmed"
  | "inferred"
  | "proposed"
  | "rejected";
export type OfferingSource =
  | "website"
  | "profile"
  | "user"
  | "ai_inference"
  | "ai_interpreted";

export type OfferingProposal = {
  id: string;
  name: string;
  shortDescription: string;
  problemSolved: string;
  includedProducts: string[];
  includedServices: string[];
  supportingCapabilityIds: string[];
  buyerOrganizationTypes: string[];
  beneficiaryTypes: string[];
  likelyBuyerRoles: string[];
  deliveryModel?: string;
  commercialModel?: string;
  geographicConstraints: string[];
  operationalConstraints: string[];
  evidence: string[];
  source: OfferingSource;
  confidence: ProfileConfidence;
  status: OfferingStatus;
  requiresConfirmation: boolean;
  confirmationReason?: string;
};

export const offeringProposalPromptVersion = "profile-offering-proposals-v1";

export function parseOfferingProposals(value: unknown): OfferingProposal[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  const root = record(parsed, "offering proposal response");
  if (!Array.isArray(root.offerings)) {
    throw new Error("Offering proposal returned no offerings.");
  }
  if (root.offerings.length < 3 || root.offerings.length > 5) {
    throw new Error("Offering proposal must return three to five offerings.");
  }
  const offerings = root.offerings.map(parseOffering);
  if (new Set(offerings.map((offering) => offering.id)).size !== offerings.length) {
    throw new Error("Offering proposal returned duplicate IDs.");
  }
  return offerings;
}

function parseOffering(value: unknown): OfferingProposal {
  const row = record(value, "offering");
  const status = enumeration(
    row.status,
    ["suggested", "confirmed", "inferred", "proposed", "rejected"],
    "offering.status",
  );
  const source = enumeration(
    row.source,
    ["website", "profile", "user", "ai_inference", "ai_interpreted"],
    "offering.source",
  );
  const requiresConfirmation =
    status === "proposed" || status === "inferred" || row.requiresConfirmation === true;
  return {
    id: text(row.id, "offering.id"),
    name: text(row.name, "offering.name"),
    shortDescription: text(row.shortDescription, "offering.shortDescription"),
    problemSolved: text(row.problemSolved, "offering.problemSolved"),
    includedProducts: strings(row.includedProducts, "offering.includedProducts"),
    includedServices: strings(row.includedServices, "offering.includedServices"),
    supportingCapabilityIds: strings(
      row.supportingCapabilityIds,
      "offering.supportingCapabilityIds",
    ),
    buyerOrganizationTypes: strings(
      row.buyerOrganizationTypes,
      "offering.buyerOrganizationTypes",
    ),
    beneficiaryTypes: strings(row.beneficiaryTypes, "offering.beneficiaryTypes"),
    likelyBuyerRoles: strings(row.likelyBuyerRoles, "offering.likelyBuyerRoles"),
    ...(optionalText(row.deliveryModel)
      ? { deliveryModel: optionalText(row.deliveryModel) }
      : {}),
    ...(optionalText(row.commercialModel)
      ? { commercialModel: optionalText(row.commercialModel) }
      : {}),
    geographicConstraints: strings(
      row.geographicConstraints,
      "offering.geographicConstraints",
    ),
    operationalConstraints: strings(
      row.operationalConstraints,
      "offering.operationalConstraints",
    ),
    evidence: strings(row.evidence, "offering.evidence"),
    source,
    confidence: enumeration(
      row.confidence,
      ["high", "medium", "low"],
      "offering.confidence",
    ),
    status,
    requiresConfirmation,
    ...(optionalText(row.confirmationReason)
      ? { confirmationReason: optionalText(row.confirmationReason) }
      : {}),
  };
}

function parseJson(value: string) {
  try {
    return JSON.parse(
      value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error("Offering proposal returned invalid JSON.");
  }
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Offering proposal returned invalid ${field}.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2)
    throw new Error(`Offering proposal returned invalid ${field}.`);
  return value.trim();
}
function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function strings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Offering proposal returned invalid ${field}.`);
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}
function enumeration<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error(`Offering proposal returned invalid ${field}.`);
  return value as T;
}

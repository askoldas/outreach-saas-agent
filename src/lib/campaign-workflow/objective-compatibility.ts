import type { B2BRelationshipType, TargetSegment } from "./target-segments.ts";

export const campaignObjectiveCodes = [
  "direct_buyer",
  "distributor",
  "reseller",
  "channel_partner",
  "implementation_partner",
  "referral_partner",
  "supplier",
  "strategic_partner",
] as const;

export type CampaignObjectiveCode = (typeof campaignObjectiveCodes)[number];

const compatibleRelationships: Record<
  CampaignObjectiveCode,
  readonly B2BRelationshipType[]
> = {
  direct_buyer: ["customer", "public_institution"],
  distributor: ["distributor"],
  reseller: ["reseller"],
  channel_partner: ["partner", "distributor", "reseller"],
  implementation_partner: ["contractor", "partner"],
  referral_partner: ["partner"],
  supplier: ["supplier", "contractor"],
  strategic_partner: ["partner"],
};

export function parseCampaignObjective(value: unknown): CampaignObjectiveCode {
  if (
    typeof value !== "string" ||
    !campaignObjectiveCodes.includes(value as CampaignObjectiveCode)
  ) {
    throw new Error("Campaign objective is invalid.");
  }
  return value as CampaignObjectiveCode;
}

export function isObjectiveRelationshipCompatible(
  objective: CampaignObjectiveCode,
  relationship: B2BRelationshipType,
) {
  return compatibleRelationships[objective].includes(relationship);
}

export function compatibleRelationshipsForObjective(
  objective: CampaignObjectiveCode,
): readonly B2BRelationshipType[] {
  return compatibleRelationships[objective];
}

export function assertConfirmedSegmentsMatchObjective(
  objective: CampaignObjectiveCode,
  segments: readonly TargetSegment[],
) {
  const incompatible = segments.filter(
    (segment) =>
      segment.status === "confirmed" &&
      !isObjectiveRelationshipCompatible(objective, segment.relationshipType),
  );
  if (incompatible.length) {
    throw new Error(
      `Campaign objective ${objective} is incompatible with confirmed segment relationship(s): ${incompatible.map((segment) => segment.relationshipType).join(", ")}.`,
    );
  }
}

export function defaultRelationshipForObjective(
  objective: CampaignObjectiveCode,
): B2BRelationshipType {
  return compatibleRelationships[objective][0]!;
}

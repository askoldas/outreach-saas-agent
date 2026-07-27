import type { ProcurementAutonomy } from "./contracts.ts";

export type BuyingOrganizationEvidence = {
  organizationId: string;
  procurementAutonomy: ProcurementAutonomy;
  confidence: number;
  evidenceIds: string[];
};

export function selectBuyingOrganization(
  targetOrganizationId: string,
  hypotheses: BuyingOrganizationEvidence[],
): BuyingOrganizationEvidence {
  const supported = hypotheses
    .filter((hypothesis) => hypothesis.evidenceIds.length > 0)
    .sort((left, right) => right.confidence - left.confidence);
  return (
    supported[0] ?? {
      organizationId: targetOrganizationId,
      procurementAutonomy: "unknown",
      confidence: 0,
      evidenceIds: [],
    }
  );
}

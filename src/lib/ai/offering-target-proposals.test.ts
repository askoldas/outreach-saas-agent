import assert from "node:assert/strict";
import test from "node:test";
import { parseOfferingProposals } from "./offering-proposals.ts";
import { parseTargetSegmentProposalResponse } from "./target-segment-proposals.ts";

function offering(id: string, status: "confirmed" | "proposed" = "confirmed") {
  return {
    id,
    name: `Offering ${id}`,
    shortDescription: "A structured commercial proposition.",
    problemSolved: "A supported organization problem.",
    includedProducts: [],
    includedServices: ["Supported service"],
    supportingCapabilityIds: [],
    buyerOrganizationTypes: ["Companies"],
    beneficiaryTypes: ["Employees"],
    likelyBuyerRoles: ["Operations manager"],
    geographicConstraints: [],
    operationalConstraints: [],
    evidence: ["Company Profile evidence"],
    source: status === "confirmed" ? "website" : "ai_inference",
    confidence: status === "confirmed" ? "high" : "medium",
    status,
    requiresConfirmation: status === "proposed",
  };
}

test("Offering generation returns three to five structured, status-aware suggestions", () => {
  const offerings = parseOfferingProposals({
    offerings: [
      offering("existing_service"),
      offering("business_package", "proposed"),
      offering("partner_service", "proposed"),
    ],
  });
  assert.equal(offerings.length, 3);
  assert.equal(offerings[0]?.status, "confirmed");
  assert.equal(offerings[1]?.requiresConfirmation, true);
  assert.deepEqual(offerings[0]?.buyerOrganizationTypes, ["Companies"]);
  assert.deepEqual(offerings[0]?.beneficiaryTypes, ["Employees"]);
});

test("Target generation rejects consumer-only organization suggestions", () => {
  assert.throws(
    () =>
      parseTargetSegmentProposalResponse({
        targetSegments: [
          {
            id: "private_customers",
            name: "Private customers",
            summary: "People who need a service.",
            relationshipType: "customer",
            organizationTypes: ["Individual consumers", "Families"],
            industries: ["Consumer"],
            geographies: ["Latvia"],
            characteristics: [],
            buyingSignals: [],
            likelyBuyerRoles: [],
            exclusions: [],
            rationale: "They use the service.",
            supportingEvidence: [],
            discoverability: "low",
            source: "ai_suggested",
            confidence: "low",
            status: "suggested",
          },
        ],
      }),
    /discovers organizations rather than individual consumers/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertConfirmedSegmentsMatchObjective,
  compatibleRelationshipsForObjective,
  defaultRelationshipForObjective,
  isObjectiveRelationshipCompatible,
} from "./objective-compatibility.ts";

test("direct-buyer generation exposes only buyer-compatible relationships", () => {
  assert.deepEqual(compatibleRelationshipsForObjective("direct_buyer"), [
    "customer",
    "public_institution",
  ]);
});
import type { TargetSegment } from "./target-segments.ts";

function segment(relationshipType: TargetSegment["relationshipType"]): TargetSegment {
  return {
    id: `segment-${relationshipType}`,
    name: "Test organizations",
    summary: "Synthetic target organizations for a contract test.",
    relationshipType,
    organizationTypes: ["Business"],
    industries: [],
    geographies: ["DE"],
    characteristics: [],
    buyingSignals: [],
    likelyBuyerRoles: [],
    exclusions: [],
    rationale: "Synthetic fixture",
    supportingEvidence: [],
    discoverability: "medium",
    source: "user_added",
    confidence: "medium",
    status: "confirmed",
  };
}

test("direct-buyer campaigns cannot confirm supplier-only segments", () => {
  assert.throws(
    () => assertConfirmedSegmentsMatchObjective("direct_buyer", [segment("supplier")]),
    /incompatible.*supplier/,
  );
});

test("distributor campaigns cannot relabel end-user segments", () => {
  assert.throws(
    () => assertConfirmedSegmentsMatchObjective("distributor", [segment("customer")]),
    /incompatible.*customer/,
  );
  assert.equal(isObjectiveRelationshipCompatible("distributor", "distributor"), true);
  assert.equal(defaultRelationshipForObjective("distributor"), "distributor");
});

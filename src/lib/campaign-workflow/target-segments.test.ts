import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCampaignTargetDiscoverability,
  assertCampaignTargetIsDiscoverable,
  parseTargetSegments,
  type TargetSegment,
} from "./target-segments.ts";

function target(overrides: Partial<TargetSegment> = {}): TargetSegment {
  return {
    id: "business_device_fleets",
    name: "Organizations managing employee devices",
    summary: "Employers that maintain phones, laptops or tablets for their workforce.",
    relationshipType: "customer",
    organizationTypes: ["Employers with managed device fleets"],
    industries: ["Professional services", "Retail", "Logistics"],
    geographies: ["Latvia"],
    characteristics: ["Multiple employee devices"],
    buyingSignals: ["Device-management or IT support needs"],
    likelyBuyerRoles: ["IT manager", "Operations manager", "Procurement manager"],
    exclusions: ["Individual consumers"],
    rationale: "The organization buys repair capacity for employee end users.",
    supportingEvidence: ["The company repairs multiple device categories."],
    discoverability: "high",
    source: "ai_suggested",
    confidence: "medium",
    status: "suggested",
    ...overrides,
  };
}

test("Campaign targets distinguish the buyer organization from end users", () => {
  const [parsed] = parseTargetSegments([target()]);
  assert.deepEqual(parsed?.organizationTypes, ["Employers with managed device fleets"]);
  assert.ok(parsed?.likelyBuyerRoles.includes("IT manager"));
  assert.ok(!parsed?.organizationTypes.includes("Employees"));
});

test("consumer audiences remain invalid as organization-discovery targets", () => {
  assert.throws(
    () =>
      assertCampaignTargetIsDiscoverable(
        target({
          organizationTypes: ["Individual consumers", "Families"],
          industries: ["Consumer"],
        }),
      ),
    /discovers organizations rather than individual consumers/,
  );
});

test("broad manufacturers retain several coherent target routes", () => {
  const segments = parseTargetSegments([
    target({
      id: "medical_device_manufacturers",
      name: "Medical-device manufacturers",
      organizationTypes: ["Manufacturers"],
      industries: ["Medical devices"],
    }),
    target({
      id: "packaging_manufacturers",
      name: "Packaging manufacturers",
      organizationTypes: ["Manufacturers"],
      industries: ["Packaging"],
    }),
    target({
      id: "contract_manufacturing_partners",
      name: "Contract-manufacturing partners",
      relationshipType: "partner",
      organizationTypes: ["Contract manufacturers"],
      industries: ["Industrial manufacturing"],
    }),
  ]);
  assert.equal(segments.length, 3);
  assert.equal(new Set(segments.map((segment) => segment.id)).size, 3);
});

test("discoverability is recalculated instead of trusting a stale AI label", () => {
  const [parsed] = parseTargetSegments([
    target({ discoverability: "low" }),
  ]);
  assert.equal(parsed?.discoverability, "high");
  assert.equal(assessCampaignTargetDiscoverability(target()), "high");
});

test("a broad suggested target remains available for refinement but cannot be confirmed", () => {
  const broad = target({
    organizationTypes: ["Organizations"],
    industries: [],
    geographies: ["Latvia"],
    characteristics: [],
    buyingSignals: [],
    discoverability: "high",
  });
  const [suggested] = parseTargetSegments([broad]);
  assert.equal(suggested?.discoverability, "low");

  assert.throws(
    () => parseTargetSegments([{ ...broad, status: "confirmed" }]),
    /must be searchable/,
  );
});

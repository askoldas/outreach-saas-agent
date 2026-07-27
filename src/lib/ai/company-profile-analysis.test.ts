import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCompanyProfileAnalysis,
  parseCompleteJsonObject,
} from "./company-profile-analysis.ts";
import type { StructuredCompanyProfile } from "../company-profile/structured-profile.ts";

test("extracts a complete JSON object from NVIDIA reasoning wrappers", () => {
  assert.deepEqual(
    parseCompleteJsonObject(
      '<think>I should return JSON.</think>\n```json\n{"companyName":"Example"}\n```',
    ),
    { companyName: "Example" },
  );
});

test("rejects truncated model output instead of completing it", () => {
  assert.equal(parseCompleteJsonObject('{"companyName":"Example"'), undefined);
});

test("maps the compact AI response into a validated structured profile", () => {
  const result = parseCompanyProfileAnalysis(
    JSON.stringify({
      companyName: "Example Company",
      website: "https://example.test",
      summary: "Industrial maintenance provider.",
      productsAndServices: ["Plant maintenance"],
      capabilities: ["Field service"],
      customerTypes: ["Manufacturers"],
      differentiators: [],
      proofPoints: [],
      marketsAndLanguages: ["Europe"],
      claims: [],
      limitations: [],
      sources: ["https://example.test/services"],
      warnings: [],
    }),
  );
  assert.equal(result.profile.name, "Example Company");
  assert.equal(result.profile.offerings[0]?.name, "Plant maintenance");
  assert.ok(result.facts.length > 0);
});

test("maps the bounded grouped response used by free models", () => {
  const grouped = {
    companyName: "Example Pharma",
    website: "example.test",
    overview: "A pharmaceutical manufacturer serving brands through contract production.",
    sellerIndustries: ["Pharmaceuticals"],
    businessModels: ["contract_manufacturer", "wholesale"],
    offerings: [
      {
        name: "Contract manufacturing",
        description: "Finished product manufacturing and co-development.",
        businessModel: "wholesale",
        supportingCapabilities: ["Formulation", "Packaging"],
        productCategories: ["Finished dosage forms"],
        customerTypes: ["Pharmaceutical brands"],
        industries: ["Pharmaceuticals"],
        suggestedBuyerPersonas: ["External Manufacturing"],
        constraints: [],
      },
    ],
    capabilities: ["Quality control"],
    customerLandscape: {
      customerTypes: ["Pharmaceutical brands"],
      buyerIndustries: ["Pharmaceuticals"],
      customerNeeds: ["Additional production capacity"],
      relationshipTypes: ["Customer"],
      potentialMarkets: [],
    },
    markets: {
      headquarters: "Europe",
      operatingMarkets: ["European Union"],
      exportMarkets: [],
      companyLanguages: ["English"],
    },
    differentiators: [{ title: "Integrated manufacturing" }],
    proof: [{ category: "operational_evidence", title: "GMP manufacturing" }],
    sources: [{ url: "example.test/about", title: "About", confidence: "high" }],
  };
  const result = parseCompanyProfileAnalysis(JSON.stringify(grouped));
  assert.equal(result.profile.websiteUrl, "https://example.test/");
  assert.equal(result.profile.offerings.length, 1);
  assert.equal(result.profile.offerings[0]?.businessModel, "distributor_wholesaler");
  assert.deepEqual(result.profile.businessModels, [
    "contract_manufacturer",
    "distributor_wholesaler",
  ]);
  assert.deepEqual(result.profile.offerings[0]?.productCategories, [
    "Finished dosage forms",
  ]);
  assert.equal(result.profile.capabilities.length, 3);
  assert.equal(
    parseCompanyProfileAnalysis(JSON.stringify([{ result: grouped }])).profile.name,
    "Example Pharma",
  );
});

test("generates unique IDs for duplicate compact proof points", () => {
  const result = parseCompanyProfileAnalysis(
    JSON.stringify({
      companyName: "Example Company",
      website: "https://example.test",
      summary: "Industrial provider.",
      productsAndServices: ["Maintenance", "Maintenance"],
      capabilities: ["Field service", "Field service"],
      customerTypes: [],
      differentiators: ["ISO certified"],
      proofPoints: ["ISO certified"],
      marketsAndLanguages: [],
      claims: [],
      limitations: [],
      sources: ["https://example.test"],
      warnings: [],
    }),
  );
  assert.equal(result.profile.companyProof.length, 1);
  assert.equal(new Set(result.profile.offerings.map((item) => item.id)).size, 2);
  assert.equal(new Set(result.profile.capabilities.map((item) => item.id)).size, 2);
});

for (const scenario of [
  { name: "one-product SaaS", models: ["saas_software"], offerings: ["Workflow Cloud"] },
  {
    name: "multi-service agency",
    models: ["agency_consultancy"],
    offerings: ["Brand strategy", "Campaign delivery"],
  },
  { name: "manufacturer", models: ["manufacturer"], offerings: ["Industrial pumps"] },
  {
    name: "contract manufacturer with licensing and API offerings",
    models: ["contract_manufacturer", "partnership_licensing"],
    offerings: ["Contract manufacturing", "API manufacturing", "Out-licensing"],
  },
] as const) {
  test(`parses and validates a structured ${scenario.name} profile`, () => {
    const result = parseCompanyProfileAnalysis(
      JSON.stringify(fixture([...scenario.models], [...scenario.offerings])),
    );
    assert.deepEqual(result.profile.businessModels, scenario.models);
    assert.deepEqual(
      result.profile.offerings.map((offering) => offering.name),
      scenario.offerings,
    );
    assert.equal(result.profile.status, "ready");
    assert.equal(result.facts.length, scenario.offerings.length);
  });
}

test("deduplicates atomic facts and rejects malformed relations", () => {
  const value = fixture(["manufacturer"], ["Manufacturing"]);
  value.facts.push({
    id: "duplicate",
    key: "offering",
    value: "Manufacturing",
    offeringName: "Manufacturing",
    source: value.facts[0]!.source,
  });
  assert.equal(parseCompanyProfileAnalysis(JSON.stringify(value)).facts.length, 1);
  (value.profile.offerings[0]!.supportingCapabilityIds as string[]) = [
    "missing-capability",
  ];
  assert.throws(
    () => parseCompanyProfileAnalysis(JSON.stringify(value)),
    /Invalid related capability ID/,
  );
});

test("rejects invalid URLs and unsupported business models", () => {
  const value = fixture(["manufacturer"], ["Manufacturing"]);
  value.profile.websiteUrl = "javascript:alert(1)";
  assert.throws(
    () => parseCompanyProfileAnalysis(JSON.stringify(value)),
    /Invalid websiteUrl/,
  );
  const other = fixture(["manufacturer"], ["Manufacturing"]);
  (other.profile.businessModels as string[]) = ["made_up_model"];
  assert.throws(
    () => parseCompanyProfileAnalysis(JSON.stringify(other)),
    /Unsupported business model/,
  );
});

test("derives facts and a grouped commercial review when a free model omits them", () => {
  const value = fixture(["professional_service"], ["Regulatory support"]);
  delete (value as { facts?: unknown }).facts;
  delete (value as { reviewQuestions?: unknown }).reviewQuestions;
  value.profile.offerings[0]!.targetCustomerTypes = [];

  const result = parseCompanyProfileAnalysis(JSON.stringify(value));

  assert.ok(result.facts.some((fact) => fact.key === "offering"));
  assert.equal(
    result.reviewQuestions.filter((question) => question.category === "offering").length,
    1,
  );
  assert.match(result.reviewQuestions[0]!.title, /review the proposed grouping/i);
  assert.ok(result.reviewQuestions.length <= 7);
});

test("keeps an Olpha-like commercial structure grouped and reviewable", () => {
  const value = fixture(
    ["contract_manufacturer", "manufacturer", "partnership_licensing"],
    [
      "Contract manufacturing and co-development",
      "API and intermediate manufacturing",
      "Finished products and out-licensing",
      "Supplement manufacturing",
    ],
  );
  const profile = value.profile as unknown as StructuredCompanyProfile;
  profile.customerLandscape = {
    customerTypes: ["Pharmaceutical brands", "Generic manufacturers"],
    buyerIndustries: ["Pharmaceuticals"],
    customerNeeds: ["Additional EU production capacity"],
    relationshipTypes: ["Customer", "Licensing partner", "Distributor"],
    existingMarkets: ["European Union"],
    potentialMarkets: [],
  };
  profile.capabilities = [
    {
      id: "capability_rd",
      name: "R&D and formulation",
      relatedOfferingIds: ["offering_0"],
    },
  ];
  profile.offerings[0]!.supportingCapabilityIds = ["capability_rd"];
  profile.offerings[0]!.productCategories = ["Finished dosage forms", "Packaging"];

  const result = parseCompanyProfileAnalysis(JSON.stringify(value));

  assert.equal(result.profile.offerings.length, 4);
  assert.equal(result.profile.capabilities.length, 1);
  assert.deepEqual(result.profile.customerLandscape?.customerNeeds, [
    "Additional EU production capacity",
  ]);
  assert.equal(
    result.reviewQuestions.filter(
      (question) => question.fieldPath === "offerings.structure",
    ).length,
    1,
  );
  assert.equal(result.reviewQuestions.length, 1);
  assert.equal(result.reviewQuestions[0]?.stage, "profile_optional");
  assert.equal(result.reviewQuestions[0]?.required, false);
  assert.equal(
    result.reviewQuestions.some((question) => question.category === "market"),
    false,
  );
  assert.equal(
    result.reviewQuestions.some((question) => question.category === "buyer_persona"),
    false,
  );
});

function fixture(models: string[], names: string[]) {
  const now = "2026-07-23T00:00:00.000Z";
  const source = {
    url: "https://example.test/about",
    pageTitle: "About",
    extractedAt: now,
    confidence: "high",
    origin: "explicit",
  };
  const offerings = names.map((name, index) => ({
    id: `offering_${index}`,
    name,
    offeringType: "service",
    businessModel: models[Math.min(index, models.length - 1)],
    shortDescription: `${name} description`,
    valueProposition: `${name} value`,
    customerProblems: [],
    expectedOutcomes: [],
    useCases: [],
    targetCustomerTypes: ["Businesses"],
    targetIndustries: ["Technology"],
    targetCompanySizes: [],
    buyerPersonas: [],
    currentMarkets: [],
    prospectingMarkets: [],
    qualificationRequirements: [],
    disqualifyingConditions: [],
    commercialConstraints: [],
    supportingCapabilityIds: [],
    supportingProofIds: [],
    adaptiveFields: {},
    priority: index === 0 ? "primary" : "secondary",
    status: "detected",
    sourceReferences: [source],
  }));
  return {
    facts: names.map((name, index) => ({
      id: `fact_${index}`,
      key: "offering",
      value: name,
      offeringName: name,
      source,
    })),
    profile: {
      schemaVersion: 2,
      name: "Example Company",
      websiteUrl: "https://example.test/",
      shortOverview: "Commercial company overview",
      sellerIndustries: [],
      businessModels: models,
      operatingMarkets: [],
      prospectingMarkets: [],
      excludedMarkets: [],
      supportedLanguages: ["English"],
      outreachLanguages: [],
      capabilities: [],
      companyProof: [],
      existingCustomers: [],
      communicationRules: { approvedClaims: [], prohibitedClaims: [] },
      strategicDirection: [],
      offerings,
      status: "draft",
      readiness: {
        companyUnderstanding: 0,
        offeringDefinition: 0,
        customerDefinition: 0,
        buyerPersonaDefinition: 0,
        qualificationDefinition: 0,
        messagingSafety: 0,
        overall: 0,
      },
      research: { pagesAnalyzed: 3, factsExtracted: 0, sources: [source] },
    },
    reviewQuestions: [
      {
        id: "priority_markets",
        category: "market",
        title: "Which markets should Opptium prioritise?",
        inputType: "multi_select",
        options: [{ id: "de", label: "Germany" }],
        required: true,
        status: "unanswered",
      },
    ],
  };
}

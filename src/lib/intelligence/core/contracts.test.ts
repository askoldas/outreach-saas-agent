import assert from "node:assert/strict";
import test from "node:test";
import {
  commercialRelationshipAssessmentSchema,
  marketAnalysisSchema,
  marketResearchPlanSchema,
  organizationReferenceSchema,
} from "./index.ts";

const version = {
  schemaVersion: "test/v1",
  compilerVersion: "test-compiler/v1",
  inputHash: "a".repeat(64),
  contentHash: "b".repeat(64),
  createdAt: "2026-08-24T00:00:00.000Z",
};

test("Market Analysis remains a user-visible artifact distinct from its execution plan", () => {
  const analysis = marketAnalysisSchema.parse({
    id: "analysis-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    campaignTargetModelVersionId: "target-1",
    commercialIntelligenceVersionId: "commercial-1",
    geography: {
      displayName: "Latvia",
      countryCodes: ["LV"],
      localLanguages: ["Latvian"],
      workingLanguages: ["Latvian", "English"],
    },
    selectedOfferingIds: ["offering-1"],
    marketSummary: "A fragmented market with identifiable operating organizations.",
    targetArchetypes: [
      {
        archetypeId: "archetype-1",
        priority: "priority",
        rationale: "Operational need is plausible.",
      },
    ],
    marketStructure: [],
    localTerminology: [],
    localLanguages: ["Latvian"],
    majorSourceFamilies: ["local_business", "industry_directory", "web_search"],
    importantMarketSources: [],
    qualificationSignals: [],
    misleadingSignals: [],
    coverageRisks: [],
    opportunityNotes: [],
    evidenceIds: [],
    unknowns: [],
    confidence: 0.7,
    requiresUserConfirmation: false,
    version,
  });
  const plan = marketResearchPlanSchema.parse({
    id: "plan-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    marketAnalysisVersionId: analysis.id,
    campaignTargetModelVersionId: analysis.campaignTargetModelVersionId,
    providerCapabilitySnapshotIds: [],
    discoveryRoutes: [
      {
        id: "route-1",
        archetypeIds: ["archetype-1"],
        providerCapabilitySnapshotIds: ["capability-1"],
        sourceFamily: "local_business",
        providerSourceTypes: ["maps"],
        role: "primary",
        priority: 1,
        rationale: "Local operators require local-business coverage.",
        languages: ["Latvian"],
        vocabulary: [],
        sourceHints: [],
        expansionMode: "none",
        expectedCoverage: "high",
      },
    ],
    verificationRoutes: [],
    expectedCoverageRisks: [],
    redirectCriteria: [],
    stopSignals: [],
    version,
  });
  assert.equal(plan.marketAnalysisVersionId, analysis.id);
  assert.equal("discoveryRoutes" in analysis, false);
});

test("a discovery source cannot silently become an organization's official website", () => {
  const result = organizationReferenceSchema.safeParse({
    id: "reference-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    sourceRecordId: "source-1",
    providerExecutionId: "execution-1",
    providerId: "web-search",
    sourceType: "industry_directory",
    sourceUrl: "https://directory.example/member/acme",
    sourceRoles: ["discovery"],
    organizationName: "Acme",
    websiteHint: "https://directory.example/member/acme",
    matchedArchetypeIds: [],
    matchedSignals: [],
    geographyHints: [],
    organizationTypeHints: [],
    businessTypeHints: [],
    provenance: {
      extractionMethod: "list-page",
      extractionVersion: "v1",
      retrievedAt: "2026-08-24T00:00:00.000Z",
    },
    confidence: 0.5,
  });
  assert.equal(result.success, false);
});

test("organization references accept PostgreSQL timestamptz offsets", () => {
  const reference = organizationReferenceSchema.parse({
    id: "reference-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    sourceRecordId: "source-1",
    providerExecutionId: "execution-1",
    providerId: "web-search",
    sourceType: "web_search",
    sourceRoles: ["discovery"],
    organizationName: "Acme",
    matchedArchetypeIds: [],
    matchedSegmentIds: [],
    matchedSignals: [],
    geographyHints: [],
    organizationTypeHints: [],
    businessTypeHints: [],
    provenance: {
      extractionMethod: "search-result",
      extractionVersion: "v1",
      retrievedAt: "2026-08-24T21:57:36.759+00:00",
    },
    confidence: 0.5,
  });

  assert.equal(reference.provenance.retrievedAt, "2026-08-24T21:57:36.759+00:00");
});

test("commercial relationships are independent dimensions", () => {
  const result = commercialRelationshipAssessmentSchema.parse({
    id: "relationship-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    organizationId: "organization-1",
    companyIntelligenceVersionId: "intelligence-1",
    campaignTargetModelVersionId: "target-1",
    relationships: {
      manufacturer: {
        state: "confirmed",
        confidence: 0.9,
        evidenceIds: ["evidence-manufacturing"],
        counterEvidenceIds: [],
        unresolvedQuestions: [],
        rationale: "First-party manufacturing evidence.",
      },
      buyer: {
        state: "probable",
        confidence: 0.75,
        evidenceIds: ["evidence-operational-need"],
        counterEvidenceIds: [],
        unresolvedQuestions: ["Private procurement terms are not public."],
        rationale: "Its operations plausibly consume the selected input.",
      },
    },
    version,
  });
  assert.equal(result.relationships.manufacturer?.state, "confirmed");
  assert.equal(result.relationships.buyer?.state, "probable");
});

test("unknown commercial relationships remain uncertainty rather than negative evidence", () => {
  const result = commercialRelationshipAssessmentSchema.safeParse({
    id: "relationship-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    organizationId: "organization-1",
    companyIntelligenceVersionId: "intelligence-1",
    campaignTargetModelVersionId: "target-1",
    relationships: {
      buyer: {
        state: "unknown",
        confidence: 0.4,
        evidenceIds: [],
        counterEvidenceIds: [],
        unresolvedQuestions: ["Procurement evidence is unavailable."],
        rationale: "No public evidence resolves this relationship.",
      },
    },
    version,
  });
  assert.equal(result.success, false);
});

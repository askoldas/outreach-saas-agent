import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel } from "./campaign-target-model.ts";
import type { CompanyIntelligence } from "./company-intelligence.ts";
import type { CommercialRelationshipType } from "./commercial-intelligence.ts";
import {
  commercialRelationshipAssessmentSchema,
  type CommercialRelationshipAssessment,
  type CommercialRelationshipDimension,
} from "./commercial-relationships.ts";

export const COMMERCIAL_RELATIONSHIP_ASSESSMENT_SCHEMA_VERSION =
  "commercial-relationship-assessment/v1";
export const COMMERCIAL_RELATIONSHIP_COMPILER_VERSION =
  "company-target-relationship-compiler/v1";

export function compileCommercialRelationshipAssessment(input: {
  artifactId: string;
  companyIntelligence: CompanyIntelligence;
  target: CampaignTargetModel;
  matchedArchetypeIds: string[];
  createdAt: string;
}): CommercialRelationshipAssessment {
  assertIdentity(input);
  const matchedIds = new Set(input.matchedArchetypeIds);
  const matchedArchetypes = input.target.archetypes.filter(({ id }) =>
    matchedIds.has(id),
  );
  if (matchedIds.size !== matchedArchetypes.length) {
    throw new Error("Commercial Relationship input references an unknown archetype.");
  }
  const roleEvidence = evidenceByOrganizationRole(input.companyIntelligence);
  const relationshipTypes = uniqueSorted([
    ...input.companyIntelligence.organizationRoles,
    ...input.target.objective.desiredRelationships,
    ...matchedArchetypes.flatMap(({ likelyRelationships }) => likelyRelationships),
  ]);
  const relationships = Object.fromEntries(
    relationshipTypes.map((relationship) => [
      relationship,
      dimension({
        relationship,
        explicitEvidenceIds: roleEvidence.get(relationship) ?? [],
        expectedByArchetype: matchedArchetypes.some(({ likelyRelationships }) =>
          likelyRelationships.includes(relationship),
        ),
        desiredByObjective:
          input.target.objective.desiredRelationships.includes(relationship),
        intelligenceConfidence: input.companyIntelligence.confidence,
      }),
    ]),
  );
  const body = {
    workspaceId: input.companyIntelligence.workspaceId,
    campaignId: input.target.campaignId,
    organizationId: input.companyIntelligence.organizationId,
    companyIntelligenceVersionId: input.companyIntelligence.id,
    campaignTargetModelVersionId: input.target.id,
    relationships,
  };
  return commercialRelationshipAssessmentSchema.parse({
    id: input.artifactId,
    ...body,
    version: {
      schemaVersion: COMMERCIAL_RELATIONSHIP_ASSESSMENT_SCHEMA_VERSION,
      compilerVersion: COMMERCIAL_RELATIONSHIP_COMPILER_VERSION,
      inputHash: hashCanonical({
        companyIntelligenceContentHash: input.companyIntelligence.version.contentHash,
        targetContentHash: input.target.version.contentHash,
        matchedArchetypeIds: uniqueSorted(input.matchedArchetypeIds),
        compilerVersion: COMMERCIAL_RELATIONSHIP_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
    },
  });
}

function dimension(input: {
  relationship: CommercialRelationshipType;
  explicitEvidenceIds: string[];
  expectedByArchetype: boolean;
  desiredByObjective: boolean;
  intelligenceConfidence: number;
}): CommercialRelationshipDimension {
  if (input.explicitEvidenceIds.length) {
    return {
      state: "confirmed",
      confidence: input.intelligenceConfidence,
      evidenceIds: uniqueSorted(input.explicitEvidenceIds),
      counterEvidenceIds: [],
      unresolvedQuestions: [],
      rationale: `Reusable Company Intelligence explicitly supports the ${input.relationship} role.`,
    };
  }
  if (input.expectedByArchetype) {
    return {
      state: "possible",
      confidence: Math.min(0.49, input.intelligenceConfidence),
      evidenceIds: [],
      counterEvidenceIds: [],
      unresolvedQuestions: [
        `Does the organization actually operate as a ${input.relationship} for this Campaign?`,
      ],
      rationale:
        "The matched target archetype makes this relationship plausible but does not prove it.",
    };
  }
  return {
    state: "unknown",
    confidence: 0,
    evidenceIds: [],
    counterEvidenceIds: [],
    unresolvedQuestions: [
      `What evidence establishes or contradicts the ${input.relationship} relationship?`,
    ],
    rationale: input.desiredByObjective
      ? "The Campaign desires this relationship, but desired intent is not organization evidence."
      : "Available Company Intelligence does not resolve this relationship.",
  };
}

function evidenceByOrganizationRole(intelligence: CompanyIntelligence) {
  const roles = new Map<CommercialRelationshipType, string[]>();
  for (const relationship of intelligence.organizationRoles) {
    const evidenceIds = intelligence.claims
      .filter(({ fieldPath }) =>
        ["organization.organizationRoles", "organization.roles"].includes(fieldPath),
      )
      .flatMap(({ evidenceIds }) => evidenceIds);
    roles.set(relationship, uniqueSorted(evidenceIds));
  }
  return roles;
}

function assertIdentity(
  input: Parameters<typeof compileCommercialRelationshipAssessment>[0],
) {
  if (input.companyIntelligence.workspaceId !== input.target.workspaceId) {
    throw new Error("Commercial Relationship inputs belong to different workspaces.");
  }
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

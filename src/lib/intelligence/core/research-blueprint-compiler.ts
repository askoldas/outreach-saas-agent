import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel, TargetArchetype } from "./campaign-target-model.ts";
import type { MarketAnalysis } from "./market-intelligence.ts";
import { researchBlueprintSchema, type ResearchBlueprint } from "./research-blueprint.ts";

export const RESEARCH_BLUEPRINT_SCHEMA_VERSION = "research-blueprint/v1";
export const RESEARCH_BLUEPRINT_COMPILER_VERSION =
  "target-archetype-research-blueprint-compiler/v1";

export function compileResearchBlueprints(input: {
  artifactId: (archetypeId: string) => string;
  target: CampaignTargetModel;
  analysis: MarketAnalysis;
  createdAt: string;
}): ResearchBlueprint[] {
  assertInputs(input);
  return [...input.target.archetypes]
    .filter(({ priority }) => priority !== "incompatible")
    .sort((a, b) => compareText(a.id, b.id))
    .map((archetype) => compileBlueprint(input, archetype));
}

function compileBlueprint(
  input: Parameters<typeof compileResearchBlueprints>[0],
  archetype: TargetArchetype,
) {
  const researchQuestions = questions(archetype);
  const body = {
    workspaceId: input.target.workspaceId,
    campaignId: input.target.campaignId,
    targetArchetypeId: archetype.id,
    campaignTargetModelVersionId: input.target.id,
    marketAnalysisVersionId: input.analysis.id,
    researchQuestions,
    preferredSourceTypes: preferredSourceTypes(input.analysis.majorSourceFamilies),
    requiredEvidenceDimensions: uniqueSorted([
      "identity",
      "business_model",
      "products_services",
      "operations",
      "operating_geographies",
    ]),
    optionalEvidenceDimensions: uniqueSorted([
      "scale",
      "facilities",
      "customer_types",
      "procurement_characteristics",
    ]),
    operationalSignals: uniqueSorted([
      ...archetype.positiveSignals.map(({ key }) => key),
      ...archetype.operationalEvidenceOfNeed.map(
        (_, index) => `operational_need.${archetype.id}.${index + 1}`,
      ),
    ]),
    exclusionChecks: uniqueSorted(archetype.hardExclusionRuleKeys),
    stoppingCriteria: {
      minimumRequiredCoverage: 0.75,
      maximumFirstPartyPages: 8,
      maximumSupportingSources: 4,
      stopWhenCriticalUnknownsResolved: true,
    },
  };
  return researchBlueprintSchema.parse({
    id: input.artifactId(archetype.id),
    ...body,
    version: {
      schemaVersion: RESEARCH_BLUEPRINT_SCHEMA_VERSION,
      compilerVersion: RESEARCH_BLUEPRINT_COMPILER_VERSION,
      inputHash: hashCanonical({
        targetContentHash: input.target.version.contentHash,
        analysisContentHash: input.analysis.version.contentHash,
        archetypeId: archetype.id,
        compilerVersion: RESEARCH_BLUEPRINT_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
    },
  });
}

function questions(archetype: TargetArchetype) {
  const reusable = [
    question(
      "identity",
      "What is the organization's verified identity and official web presence?",
      true,
      100,
      ["identity", "first_party"],
    ),
    question(
      "business_model",
      "What business model and value-chain roles does the organization operate?",
      true,
      95,
      ["first_party", "supporting"],
    ),
    question(
      "products_services",
      "Which products and services does the organization currently offer?",
      true,
      90,
      ["first_party", "supporting"],
    ),
    question(
      "operations",
      "What operational activities, facilities, and processes does the organization run?",
      true,
      85,
      ["first_party", "supporting"],
    ),
    question(
      "operating_markets",
      "In which markets and locations does the organization operate?",
      true,
      80,
      ["identity", "first_party", "supporting"],
    ),
    question(
      "scale",
      "What reliable evidence describes the organization's operating scale?",
      false,
      60,
      ["first_party", "supporting"],
    ),
  ];
  const operational = archetype.operationalEvidenceOfNeed.map((need, index) =>
    question(
      `operational_need.${archetype.id}.${index + 1}`,
      `What public evidence confirms or contradicts this operational characteristic: ${need}`,
      false,
      70 - index,
      ["first_party", "supporting"],
    ),
  );
  return [...reusable, ...operational]
    .sort(
      (a, b) =>
        Number(b.required) - Number(a.required) ||
        b.priority - a.priority ||
        compareText(a.key, b.key),
    )
    .slice(0, 12);
}

function question(
  key: string,
  text: string,
  required: boolean,
  priority: number,
  evidenceRoles: Array<"identity" | "first_party" | "supporting">,
) {
  return { key, question: text, required, priority, evidenceRoles };
}

function preferredSourceTypes(families: MarketAnalysis["majorSourceFamilies"]) {
  return uniqueSorted([
    "official_website",
    ...families,
    "legal_registry",
    "official_document",
  ]);
}

function assertInputs(input: Parameters<typeof compileResearchBlueprints>[0]) {
  if (
    input.target.workspaceId !== input.analysis.workspaceId ||
    input.target.campaignId !== input.analysis.campaignId ||
    input.analysis.campaignTargetModelVersionId !== input.target.id
  ) {
    throw new Error("Research Blueprint inputs do not share frozen Campaign identity.");
  }
  const analysisArchetypes = new Set(
    input.analysis.targetArchetypes.map(({ archetypeId }) => archetypeId),
  );
  if (
    input.target.archetypes
      .filter(({ priority }) => priority !== "incompatible")
      .some(({ id }) => !analysisArchetypes.has(id))
  ) {
    throw new Error("Market Analysis omits a Target Model archetype.");
  }
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

import {
  campaignBriefPromptVersion,
  parseCampaignBriefProposal,
} from "@/lib/campaign-workflow/contracts";
import type { CampaignPlanningProfile } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { generateTextResult } from "@/lib/providers/openrouter";
import type { AiCallResult } from "@/lib/providers/openrouter";
import { parseCompleteJsonObject } from "@/lib/ai/structured-json";
import { z } from "zod";
import {
  executeValidatedAiTask,
  type IntelligenceAttemptRecord,
} from "@/lib/intelligence/runtime/execute-ai-task";
import { IntelligenceSchemaRegistry } from "@/lib/intelligence/runtime/schema-registry";
import { IntelligenceTaskRegistry, type PromptDefinition } from "@/lib/intelligence/runtime/task-registry";
import {
  compatibleRelationshipsForObjective,
  isObjectiveRelationshipCompatible,
  type CampaignObjectiveCode,
} from "@/lib/campaign-workflow/objective-compatibility";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";

export async function generateCampaignBriefProposal(input: {
  geography: { countryCodes: string[]; regionLabel?: string };
  profile: CampaignPlanningProfile;
  objective: CampaignObjectiveCode;
  selectedOfferingKey: string;
  runtime?: { recordAttempt?: (attempt: IntelligenceAttemptRecord) => Promise<void> };
}) {
  if (!input.geography.countryCodes.length && !input.geography.regionLabel) {
    throw new Error("Choose at least one country or region first.");
  }
  const offering = input.profile.offerings.find(
    (candidate) => candidate.stableKey === input.selectedOfferingKey,
  );
  if (!offering) throw new Error("Select one campaign-ready published offering.");
  const proposalInput = {
    geography: input.geography,
    objective: input.objective,
    selectedOfferingKey: offering.stableKey,
    selectedOfferingVersionId: offering.offeringVersionId,
    profileVersionId: input.profile.profileVersionId,
  };
  const allowedRelationships = compatibleRelationshipsForObjective(input.objective);

  assertIntelligenceExternalCallsAllowed("model");
  const modelCall = await executeCampaignBriefModel(
    [
      {
        role: "system",
        content:
          "Propose one concise B2B campaign brief for the supplied geography, commercial objective, and exact selected offering. Never select, substitute, or combine another offering. Use only organization relationships compatible with the objective. Prefer the selected offering's buyer logic, active compatible archetypes, relationship options, and applicable confirmed rules. Consumers, families, private customers, and decision-maker job titles are invalid target organizations. Return JSON matching the requested shape. Do not modify the frozen profile. Ask at most one focused clarification only when its answer can materially change the target proposal.",
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: campaignBriefPromptVersion,
          geography: input.geography,
          objective: input.objective,
          company: {
            name: input.profile.companyName,
            commercialSummary: input.profile.commercialSummary,
            companyRoles: input.profile.companyRoles,
            confirmedRules: input.profile.rules
              .filter((rule) => rule.status === "confirmed")
              .slice(0, 30),
            selectedOffering: {
              id: offering.stableKey,
              versionId: offering.offeringVersionId,
              name: offering.name,
              offeringType: offering.offeringType,
              summary: offering.shortDescription,
              confidence: offering.confidence,
              commercialMechanics: offering.commercialMechanics,
              buyerLogic: offering.buyerLogic,
              relationshipOptions: offering.relationshipOptions.filter((option) =>
                isObjectiveRelationshipCompatible(
                  input.objective,
                  normalizeProfileRelationship(option.relationshipType),
                ),
              ),
              buyerArchetypes: offering.archetypes
                .filter(
                  (archetype) =>
                    archetype.status !== "user_rejected" &&
                    archetype.status !== "superseded" &&
                    archetype.priority !== "avoid" &&
                    isObjectiveRelationshipCompatible(
                      input.objective,
                      normalizeProfileRelationship(archetype.relationshipType),
                    ),
                )
                .slice(0, 5),
            },
          },
          requiredShape: {
            geography: { countryCodes: [], regionLabel: "", primaryLanguage: "" },
            offering: {
              profileOfferingIds: ["exactly-one-supplied-offering-id"],
              title: "",
              summary: "",
              valueProposition: "",
              rationale: "",
            },
            targetClient: {
              companyTypes: [],
              industries: [],
              employeeRange: { min: 1, max: 100 },
              characteristics: [],
              positiveSignals: [],
              requiredCriteria: [],
              exclusions: [],
              recommendedDecisionMakerRoles: [],
              summary: "",
            },
            targetSegments: [
              {
                id: "stable-segment-id",
                name: "searchable organization segment",
                summary: "",
                relationshipType: allowedRelationships.join("|"),
                organizationTypes: [],
                industries: [],
                companySize: { minimumEmployees: 1, maximumEmployees: 100 },
                geographies: input.geography.countryCodes,
                characteristics: [],
                buyingSignals: [],
                likelyBuyerRoles: [],
                exclusions: [],
                rationale: "",
                supportingEvidence: [],
                discoverability: "high|medium",
                source: "ai_suggested",
                confidence: "high|medium|low",
                status: "suggested",
              },
            ],
            ambiguity: { requiresClarification: false },
            confidence: 0.8,
          },
        }),
      },
    ],
    {
      role: "campaign_planning",
      taskName: "campaign brief proposal",
      jsonMode: true,
      maxCompletionTokens: 5500,
    },
    new Set([offering.stableKey]),
    input.runtime,
  );
  const proposal = parseCampaignBriefProposalOutput(
    modelCall.data,
    new Set([offering.stableKey]),
  );
  const incompatibleRelationships = [
    ...new Set(
      proposal.targetSegments
        .filter(
          (segment) =>
            segment.status !== "rejected" &&
            !isObjectiveRelationshipCompatible(input.objective, segment.relationshipType),
        )
        .map((segment) => segment.relationshipType),
    ),
  ];
  if (incompatibleRelationships.length) {
    throw new Error(
      `Campaign planning returned target relationships incompatible with ${input.objective}: ${incompatibleRelationships.join(", ")}. Generate the target organizations again.`,
    );
  }
  return {
    proposal: {
      ...proposal,
      provenance: {
        ...proposalInput,
        promptVersion: campaignBriefPromptVersion,
        inputHash: hashCanonical(proposalInput),
      },
    },
    promptVersion: campaignBriefPromptVersion,
    modelCall,
  };
}

async function executeCampaignBriefModel(
  messages: Array<{ role: "system" | "user"; content: string }>,
  options: {
    role: "campaign_planning";
    taskName: string;
    jsonMode: true;
    maxCompletionTokens: number;
  },
  offeringIds: ReadonlySet<string>,
  runtime?: { recordAttempt?: (attempt: IntelligenceAttemptRecord) => Promise<void> },
): Promise<AiCallResult<string>> {
  type Proposal = ReturnType<typeof parseCampaignBriefProposal>;
  const dynamicSchema = z.unknown().transform((value, context): Proposal => {
    try {
      return parseCampaignBriefProposal(value, offeringIds);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid campaign brief proposal.",
      });
      return z.NEVER;
    }
  });
  const definition: PromptDefinition<
    { messages: Array<{ role: "system" | "user"; content: string }> },
    Proposal
  > = {
    taskId: "campaign.interactive_brief_proposal",
    promptVersion: campaignBriefPromptVersion,
    schemaVersion: "campaign-brief-proposal/v4-dynamic-offering",
    contextCompilerVersion: "campaign-brief-context/v4-objective-first",
    modelRole: "campaign_strategy_reasoning",
    title: options.taskName,
    description: "Propose one bounded campaign brief for one frozen offering.",
    buildMessages: (request) => request.messages,
    outputSchema: dynamicSchema,
    maxCompletionTokens: options.maxCompletionTokens,
    reasoningClass: "minimal",
    allowsRepair: true,
    allowsFallback: true,
  };
  const tasks = new IntelligenceTaskRegistry();
  tasks.register(definition);
  const schemas = new IntelligenceSchemaRegistry();
  schemas.register({
    taskId: definition.taskId,
    schemaVersion: definition.schemaVersion,
    schema: dynamicSchema,
    jsonSchema: { type: "object", additionalProperties: true },
    semanticValidators: [],
  });
  const result = await executeValidatedAiTask<
    { messages: Array<{ role: "system" | "user"; content: string }> },
    Proposal
  >({
    registry: tasks,
    schemas,
    taskId: definition.taskId,
    promptVersion: definition.promptVersion,
    modelRouteVersion: "campaign-planning-route/v2-shared-runtime",
    request: { messages },
    ...(runtime?.recordAttempt ? { recordAttempt: runtime.recordAttempt } : {}),
    transport: async (transport) => {
      const call = await generateTextResult(transport.messages, {
        role: options.role,
        taskName: options.taskName,
        maxCompletionTokens: transport.maxCompletionTokens,
        ...(transport.output.mode === "json_schema"
          ? { jsonSchema: transport.output }
          : { jsonMode: true }),
      });
      return {
        output: call.data,
        requestedModel: call.requestedModel,
        actualModel: call.actualModel ?? call.requestedModel,
        fallbackUsed: call.fallbackUsed,
        requestHash: hashCanonical(transport.messages),
        responseHash: hashCanonical(call.data),
        latencyMs: call.latencyMs,
        inputUnits: call.inputTokens,
        outputUnits: call.outputTokens,
        actualCost: call.providerReportedCost,
        currency: call.providerCurrency,
      };
    },
  });
  return {
    data: JSON.stringify(result.data),
    provider: "openrouter",
    requestedModel: result.provenance.requestedModel,
    actualModel: result.provenance.actualModel,
    fallbackUsed: result.provenance.fallbackUsed,
    inputTokens: result.provenance.inputUnits,
    outputTokens: result.provenance.outputUnits,
    providerReportedCost: result.provenance.actualCost,
    providerCurrency: result.provenance.currency === "USD" ? "USD" : undefined,
    latencyMs: result.provenance.latencyMs ?? 0,
  };
}

function normalizeProfileRelationship(value: string) {
  if (value === "direct_buyer" || value === "end_user") return "customer" as const;
  if (value === "implementation_partner") return "contractor" as const;
  if (
    value === "customer" ||
    value === "partner" ||
    value === "distributor" ||
    value === "reseller" ||
    value === "supplier" ||
    value === "contractor" ||
    value === "public_institution"
  ) {
    return value;
  }
  return "partner" as const;
}

export function parseCampaignBriefProposalOutput(
  rawOutput: string,
  offeringIds: ReadonlySet<string>,
) {
  const raw = parseCompleteJsonObject(rawOutput);
  if (raw === undefined) {
    throw new Error("Campaign planning returned invalid JSON.");
  }
  return parseCampaignBriefProposal(raw, offeringIds);
}

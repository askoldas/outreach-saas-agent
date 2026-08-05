import { z } from "zod";
import { generateTextResult } from "../providers/openrouter.ts";
import type { AiCallResult } from "../providers/openrouter.ts";
import {
  executeValidatedAiTask,
  type IntelligenceAttemptRecord,
} from "../intelligence/runtime/execute-ai-task.ts";
import { IntelligenceSchemaRegistry } from "../intelligence/runtime/schema-registry.ts";
import { IntelligenceTaskRegistry, type PromptDefinition } from "../intelligence/runtime/task-registry.ts";
import { hashCanonical } from "../intelligence/campaign-strategy-v2/context-compiler.ts";
import {
  providerDiscoveryResponseSchema,
  type ProviderDiscoveryRequest,
  type ProviderDiscoveryResponse,
} from "./contracts.ts";

export const CANDIDATE_PRECLASSIFICATION_PROMPT_VERSION =
  "candidate-commercial-plausibility/v1.0";

const itemSchema = z
  .object({
    sourceRecordKey: z.string().min(1),
    probableRelationshipTypes: z.array(z.string()).max(4),
    objectiveCompatibility: z.enum(["compatible", "incompatible", "unknown"]),
    reasonCode: z.enum([
      "explicit_target_relationship",
      "explicit_incompatible_commercial_role",
      "insufficient_commercial_evidence",
    ]),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const outputSchema = z.object({ classifications: z.array(itemSchema).max(32) }).strict();

type Generator = typeof generateTextResult;

export async function refinePlausibleCandidateClassifications(input: {
  request: ProviderDiscoveryRequest;
  response: ProviderDiscoveryResponse;
  generate?: Generator;
  runtime?: { recordAttempt?: (attempt: IntelligenceAttemptRecord) => Promise<void> };
}): Promise<{
  response: ProviderDiscoveryResponse;
  call?: AiCallResult<string>;
}> {
  const plausible = input.response.classifications.filter(({ disposition }) =>
    ["candidate", "needs_review"].includes(disposition),
  );
  if (!plausible.length) return { response: input.response };
  const plausibleKeys = new Set(plausible.map(({ sourceRecordKey }) => sourceRecordKey));
  const records = input.response.records
    .filter(({ sourceRecordKey }) => plausibleKeys.has(sourceRecordKey))
    .slice(0, 32)
    .map((record) => ({
      sourceRecordKey: record.sourceRecordKey,
      title: stringField(record.rawPayload, "title"),
      url: record.sourceUrl,
      evidenceText: stringField(record.rawPayload, "content").slice(0, 1_500),
    }));
  const request = {
    target: {
      relationshipType: input.request.segment.relationshipType,
      organizationRoles: input.request.segment.businessCharacteristics.organizationRoles,
      industries: input.request.segment.businessCharacteristics.industries,
    },
    records,
  };
  const definition: PromptDefinition<typeof request, z.infer<typeof outputSchema>> = {
    taskId: "discovery.candidate_preclassification",
    promptVersion: CANDIDATE_PRECLASSIFICATION_PROMPT_VERSION,
    schemaVersion: "candidate-commercial-plausibility/v1",
    contextCompilerVersion: "candidate-preclassification-context/v1",
    modelRole: "candidate_classification",
    title: "Candidate commercial preclassification",
    description: "Classify commercial relationship plausibility from frozen search evidence.",
    buildMessages: (value) => [
      {
        role: "system",
        content:
          "Classify commercial relationship plausibility from only the supplied search evidence. Do not score fit, potential, eligibility, or rank. Unknown evidence must remain unknown. Return one item per sourceRecordKey.",
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: CANDIDATE_PRECLASSIFICATION_PROMPT_VERSION,
          ...value,
        }),
      },
    ],
    outputSchema,
    maxCompletionTokens: 2_400,
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
    schema: outputSchema,
    semanticValidators: [],
  });
  const result = await executeValidatedAiTask<typeof request, z.infer<typeof outputSchema>>({
    registry: tasks,
    schemas,
    taskId: definition.taskId,
    promptVersion: definition.promptVersion,
    modelRouteVersion: "candidate-preclassification-route/v1-shared-runtime",
    request,
    ...(input.runtime?.recordAttempt ? { recordAttempt: input.runtime.recordAttempt } : {}),
    transport: async (transport) => {
      const call = await (input.generate ?? generateTextResult)(transport.messages, {
        role: "search_result_classification",
        maxCompletionTokens: transport.maxCompletionTokens,
        reasoningEffort: "minimal",
        taskName: "commercial candidate preclassification",
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
  const parsed = result.data;
  const byKey = new Map(
    parsed.classifications.map((item) => [item.sourceRecordKey, item]),
  );
  if (
    byKey.size !== records.length ||
    records.some(({ sourceRecordKey }) => !byKey.has(sourceRecordKey)) ||
    [...byKey].some(([key]) => !plausibleKeys.has(key))
  ) {
    throw new Error("Candidate classifier output does not match its frozen source set.");
  }
  const classifications = input.response.classifications.map((classification) => {
    const refinement = byKey.get(classification.sourceRecordKey);
    if (!refinement) return classification;
    const incompatible = refinement.objectiveCompatibility === "incompatible";
    return {
      ...classification,
      disposition: incompatible
        ? ("reject" as const)
        : refinement.objectiveCompatibility === "unknown"
          ? ("needs_review" as const)
          : classification.disposition,
      probableRelationshipTypes: refinement.probableRelationshipTypes,
      objectiveCompatibility: refinement.objectiveCompatibility,
      reasonCodes: [...new Set([...classification.reasonCodes, refinement.reasonCode])],
      confidence: Math.min(classification.confidence, refinement.confidence),
      classifierVersion: `${classification.classifierVersion}+model:${CANDIDATE_PRECLASSIFICATION_PROMPT_VERSION}`,
    };
  });
  const acceptedKeys = new Set(
    classifications
      .filter(({ disposition }) => ["candidate", "needs_review"].includes(disposition))
      .map(({ sourceRecordKey }) => sourceRecordKey),
  );
  return {
    response: providerDiscoveryResponseSchema.parse({
      ...input.response,
      classifications,
      normalizedCandidates: input.response.normalizedCandidates.filter(
        ({ sourceRecordKey }) => acceptedKeys.has(sourceRecordKey),
      ),
    }),
    call: {
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
    },
  };
}

function stringField(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" ? value[key] : "";
}

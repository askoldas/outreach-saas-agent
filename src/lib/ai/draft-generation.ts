import { z } from "zod";
import { generateTextResult, type AiCallResult } from "../providers/openrouter.ts";
import {
  executeValidatedAiTask,
  type IntelligenceAttemptRecord,
} from "../intelligence/runtime/execute-ai-task.ts";
import { IntelligenceTaskRegistry, type PromptDefinition } from "../intelligence/runtime/task-registry.ts";
import { IntelligenceSchemaRegistry } from "../intelligence/runtime/schema-registry.ts";
import { hashCanonical } from "../intelligence/campaign-strategy-v2/context-compiler.ts";

export const draftPromptVersion = "grounded-outreach-draft-v2-shared-runtime";

export type DraftGenerationInput = {
  campaign: { name: string; objective: string; preferredOutreachLanguage: string };
  companyProfile: Record<string, unknown>;
  strategy: Record<string, unknown>;
  lead: {
    company: string;
    website: string;
    summary: string;
    evidence: Array<{ text: string; sourceUrl: string }>;
  };
  recipient: { route: string; role: string; verification: string };
};

export const generatedDraftSchema = z.object({
  subject: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(5_000),
  sellerClaims: z.array(z.string().trim().min(1)).max(20),
  evidenceUsed: z.array(z.string().trim().min(1)).max(20),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
}).strict();

export type GeneratedDraft = z.infer<typeof generatedDraftSchema>;

export const outreachDraftTaskDefinition: PromptDefinition<
  DraftGenerationInput,
  GeneratedDraft
> = {
  taskId: "outreach.grounded_draft",
  promptVersion: draftPromptVersion,
  schemaVersion: "outreach-draft/v2",
  contextCompilerVersion: "outreach-grounding-context/v2",
  modelRole: "outreach_generation",
  title: "Grounded outreach draft",
  description: "Write one concise outreach draft using only frozen seller claims and prospect evidence.",
  buildMessages: (input) => [
    {
      role: "system",
      content: [
        "You write concise, factual B2B outreach drafts.",
        "Use only seller claims present in companyProfile and prospect facts present in lead.evidence.",
        "Do not invent names, results, relationships, or private information.",
        "Return JSON only with subject, body, sellerClaims, evidenceUsed, warnings.",
        "sellerClaims and evidenceUsed must contain the exact supporting input statements used.",
      ].join(" "),
    },
    { role: "user", content: JSON.stringify(input) },
  ],
  outputSchema: generatedDraftSchema,
  maxCompletionTokens: 2_000,
  reasoningClass: "minimal",
  allowsRepair: true,
  allowsFallback: true,
};

export async function generateGroundedDraft(
  input: DraftGenerationInput,
  runtime?: {
    recordAttempt?: (attempt: IntelligenceAttemptRecord) => Promise<void>;
  },
) {
  const tasks = new IntelligenceTaskRegistry();
  tasks.register(outreachDraftTaskDefinition);
  const schemas = new IntelligenceSchemaRegistry();
  schemas.register({
    taskId: outreachDraftTaskDefinition.taskId,
    schemaVersion: outreachDraftTaskDefinition.schemaVersion,
    schema: outreachDraftTaskDefinition.outputSchema,
    semanticValidators: [(draft) => validateGrounding(draft, input)],
  });
  const result = await executeValidatedAiTask<DraftGenerationInput, GeneratedDraft>({
    registry: tasks,
    schemas,
    taskId: outreachDraftTaskDefinition.taskId,
    promptVersion: outreachDraftTaskDefinition.promptVersion,
    modelRouteVersion: "outreach-generation-route/v1",
    request: input,
    ...(runtime?.recordAttempt ? { recordAttempt: runtime.recordAttempt } : {}),
    transport: async (request) => {
      const call = await generateTextResult(request.messages, {
        role: "outreach_generation",
        maxCompletionTokens: request.maxCompletionTokens,
        reasoningEffort:
          request.reasoningClass === "standard" ? "medium" : request.reasoningClass,
        taskName: "grounded outreach draft",
        ...(request.output.mode === "json_schema"
          ? { jsonSchema: request.output }
          : { jsonMode: true }),
      });
      return {
        output: call.data,
        requestedModel: call.requestedModel,
        actualModel: call.actualModel ?? call.requestedModel,
        fallbackUsed: call.fallbackUsed,
        requestHash: hashCanonical(request.messages),
        responseHash: hashCanonical(call.data),
        latencyMs: call.latencyMs,
        inputUnits: call.inputTokens,
        outputUnits: call.outputTokens,
        actualCost: call.providerReportedCost,
        currency: call.providerCurrency,
      };
    },
  });
  const modelCall: AiCallResult<string> = {
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
  return { draft: result.data, rawOutput: modelCall.data, modelCall };
}

export function parseGeneratedDraft(rawOutput: string): GeneratedDraft {
  const json = rawOutput.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Draft generator returned invalid JSON.");
  }
  return generatedDraftSchema.parse(value);
}

function validateGrounding(draft: GeneratedDraft, input: DraftGenerationInput) {
  const evidence = new Set(input.lead.evidence.map((item) => item.text));
  if (draft.evidenceUsed.some((item) => !evidence.has(item))) {
    throw new Error("Outreach draft cited prospect evidence outside its frozen input.");
  }
  const profileText = JSON.stringify(input.companyProfile);
  if (draft.sellerClaims.some((claim) => !profileText.includes(JSON.stringify(claim).slice(1, -1)))) {
    throw new Error("Outreach draft cited a seller claim outside its frozen Company Profile.");
  }
}

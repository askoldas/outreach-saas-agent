import type {
  ConfidenceLevel,
  InterpretedStructuredChanges,
  UserModificationIntent,
} from "../guided/contracts.ts";
import type { TargetSegment } from "../campaign-workflow/target-segments.ts";
import { parseOfferingProposals, type OfferingProposal } from "./offering-proposals.ts";
import { parseTargetSegments } from "../campaign-workflow/target-segments.ts";
import { generateTextResult } from "../providers/openrouter.ts";

export const structuredChangePromptVersion = "structured-additive-changes-v1";

export function inferUserModificationIntents(
  instruction: string,
): UserModificationIntent[] {
  const value = instruction.trim().toLowerCase();
  const intents = new Set<UserModificationIntent>();
  if (/\b(also|add|include|we provide|another)\b/.test(value)) intents.add("add");
  if (/\b(change|rename|adjust|update|modify)\b/.test(value)) intents.add("update");
  if (/\b(remove|exclude|do not provide|don't provide)\b/.test(value))
    intents.add("remove");
  if (/\b(replace|instead|only)\b/.test(value)) intents.add("replace");
  if (/\b(combine|merge)\b/.test(value)) intents.add("combine");
  if (/\b(restore|bring back)\b/.test(value)) intents.add("restore");
  if (/\b(more|alternatives|other options)\b/.test(value)) intents.add("request_more");
  if (/\b(explain|why)\b/.test(value)) intents.add("request_explanation");
  if (/\b(none|not relevant|reject all)\b/.test(value)) intents.add("reject_all");
  return intents.size ? [...intents] : ["unclear"];
}

export async function interpretOfferingChanges(input: {
  currentItems: OfferingProposal[];
  recentlyRemovedItems: OfferingProposal[];
  instruction: string;
  profileContext: Record<string, unknown>;
}) {
  return interpretChanges({
    entity: "Offering",
    currentItems: input.currentItems,
    recentlyRemovedItems: input.recentlyRemovedItems,
    instruction: input.instruction,
    context: input.profileContext,
    parseEntity: (value) =>
      parseOfferingProposals({
        offerings: [value, placeholderOffering("two"), placeholderOffering("three")],
      })[0]!,
  });
}

export async function interpretTargetChanges(input: {
  currentItems: TargetSegment[];
  recentlyRemovedItems: TargetSegment[];
  instruction: string;
  campaignContext: Record<string, unknown>;
}) {
  return interpretChanges({
    entity: "Target segment",
    currentItems: input.currentItems,
    recentlyRemovedItems: input.recentlyRemovedItems,
    instruction: input.instruction,
    context: input.campaignContext,
    parseEntity: (value) => parseTargetSegments([value])[0]!,
  });
}

async function interpretChanges<T>(input: {
  entity: string;
  currentItems: T[];
  recentlyRemovedItems: T[];
  instruction: string;
  context: Record<string, unknown>;
  parseEntity: (value: unknown) => T;
}) {
  const detectedIntents = inferUserModificationIntents(input.instruction);
  const promptInput = {
    entity: input.entity,
    currentItems: input.currentItems,
    recentlyRemovedItems: input.recentlyRemovedItems,
    userInstruction: input.instruction,
    relevantContext: input.context,
    deterministicIntentHints: detectedIntents,
    requiredOutput: {
      detectedIntents: [
        "add|update|remove|replace|combine|restore|request_more|request_explanation|reject_all|unclear",
      ],
      summary: "concise change preview",
      changes: [
        {
          operation: "add|update|remove|restore|keep",
          entityId: "existing entity ID when applicable",
          proposedValue: "complete structured entity for add or update",
          reason: "concise reason",
          confidence: "high|medium|low",
        },
      ],
      keptEntityIds: ["unchanged existing ID"],
      requiresConfirmation: true,
      ambiguity: "only when intent is ambiguous",
      explanation: "only for a non-mutating explanation request",
    },
  };
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content: [
          `Interpret a contextual ${input.entity} instruction as structured changes, not as unrestricted chat.`,
          "Preserve every existing confirmed item unless the user explicitly requests replacement.",
          "Treat also, add, include, and we provide as additive. Treat change, rename, adjust, and update as targeted modifications.",
          "Replacement is allowed only for explicit replace, instead, or only intent and must be visible in the preview.",
          "Never mutate data directly. Every mutation requires user confirmation.",
          "Return keep operations or keptEntityIds for unchanged items so silent replacement is impossible.",
          "If intent is ambiguous, preview the safest additive interpretation and explain the ambiguity.",
          "Return validated JSON only, without a conversational essay.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(promptInput) },
    ],
    {
      role: "campaign_planning",
      taskName: `structured ${input.entity.toLowerCase()} change interpretation`,
      jsonMode: true,
      maxCompletionTokens: 5_000,
      reasoningEffort: "minimal",
    },
  );
  return {
    interpretation: parseStructuredChanges(modelCall.data, input.parseEntity),
    modelCall,
    promptInput,
  };
}

export function parseStructuredChanges<T>(
  value: unknown,
  parseEntity: (value: unknown) => T,
): InterpretedStructuredChanges<T> {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  const row = record(parsed, "structured change response");
  const detectedIntents = enumerations(
    row.detectedIntents,
    [
      "add",
      "update",
      "remove",
      "replace",
      "combine",
      "restore",
      "request_more",
      "request_explanation",
      "reject_all",
      "unclear",
    ],
    "detectedIntents",
  );
  if (!Array.isArray(row.changes)) throw new Error("Change response has no changes.");
  const changes = row.changes.map((value) => {
    const change = record(value, "change");
    const operation = enumeration(
      change.operation,
      ["add", "update", "remove", "restore", "keep"],
      "change.operation",
    );
    const entityId = optionalText(change.entityId);
    if (operation !== "add" && !entityId) {
      throw new Error("A non-add change requires an entity ID.");
    }
    return {
      operation,
      ...(entityId ? { entityId } : {}),
      ...(change.proposedValue !== undefined &&
      (operation === "add" || operation === "update")
        ? { proposedValue: parseEntity(change.proposedValue) }
        : {}),
      reason: text(change.reason, "change.reason"),
      confidence: enumeration(
        change.confidence,
        ["high", "medium", "low"],
        "change.confidence",
      ) as ConfidenceLevel,
    };
  });
  const replacement = detectedIntents.includes("replace");
  if (
    !replacement &&
    changes.filter((change) => change.operation === "remove").length > 1
  ) {
    throw new Error("Additive change interpretation cannot silently replace items.");
  }
  return {
    detectedIntents,
    changeSet: {
      summary: text(row.summary, "summary"),
      changes,
      requiresConfirmation: changes.some((change) => change.operation !== "keep"),
      ...(optionalText(row.ambiguity) ? { ambiguity: optionalText(row.ambiguity) } : {}),
    },
    keptEntityIds: strings(row.keptEntityIds ?? [], "keptEntityIds"),
    ...(optionalText(row.explanation)
      ? { explanation: optionalText(row.explanation) }
      : {}),
  };
}

function placeholderOffering(id: string): OfferingProposal {
  return {
    id: `validation_${id}`,
    name: `Validation offering ${id}`,
    shortDescription: "Parser validation placeholder.",
    problemSolved: "Parser validation only.",
    includedProducts: [],
    includedServices: [],
    supportingCapabilityIds: [],
    buyerOrganizationTypes: ["Organizations"],
    beneficiaryTypes: [],
    likelyBuyerRoles: [],
    geographicConstraints: [],
    operationalConstraints: [],
    evidence: [],
    source: "ai_interpreted",
    confidence: "low",
    status: "suggested",
    requiresConfirmation: true,
  };
}

function parseJson(value: string) {
  try {
    return JSON.parse(
      value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error("Structured change response returned invalid JSON.");
  }
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${field}.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2)
    throw new Error(`Invalid ${field}.`);
  return value.trim();
}
function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function strings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Invalid ${field}.`);
  return value.map((item) => item.trim()).filter(Boolean);
}
function enumeration<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error(`Invalid ${field}.`);
  return value as T;
}
function enumerations<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T[] {
  return strings(value, field).map((item) => enumeration(item, allowed, field));
}

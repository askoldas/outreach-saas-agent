export const guidedScopes = [
  "company",
  "offering",
  "campaign",
  "lead_discovery",
  "qualification",
  "messaging",
  "sequence",
] as const;
export type GuidedScope = (typeof guidedScopes)[number];

export const guidedInputTypes = [
  "single_select",
  "multi_select",
  "boolean",
  "text",
  "number",
  "range",
  "confirm",
  "structured_custom",
] as const;
export type GuidedInputType = (typeof guidedInputTypes)[number];

export type GuidedOption = {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
};

export type GuidedQuestion = {
  id: string;
  title: string;
  description?: string;
  inputType: GuidedInputType;
  options?: GuidedOption[];
  allowOther: boolean;
  allowFreeTextExplanation: boolean;
  required: boolean;
  targetFieldPaths?: string[];
};

export const proposedOperations = [
  "set",
  "add",
  "remove",
  "replace",
  "merge",
  "classify",
  "create",
] as const;
export type ProposedOperation = (typeof proposedOperations)[number];

export const proposedEntityTypes = [
  "company_profile",
  "offering",
  "icp",
  "buyer_persona",
  "campaign",
  "qualification_rule",
  "messaging_brief",
  "sequence",
] as const;
export type ProposedEntityType = (typeof proposedEntityTypes)[number];

export type ProposedChange = {
  id: string;
  operation: ProposedOperation;
  entityType: ProposedEntityType;
  entityId?: string;
  fieldPath?: string;
  previousValue?: unknown;
  proposedValue: unknown;
  reason?: string;
  confidence?: "high" | "medium" | "low";
  requiresConfirmation: boolean;
};

export type StructuredSummaryItem = {
  label: string;
  value: string | string[];
  status?: "suggested" | "selected" | "applied" | "saved" | "needs_review";
};

export type AiGuidedResponse = {
  message: string;
  context: {
    scope: GuidedScope;
    companyProfileId?: string;
    offeringId?: string;
    campaignId?: string;
  };
  question?: GuidedQuestion;
  proposedChanges?: ProposedChange[];
  summaryCard?: { title: string; items: StructuredSummaryItem[] };
  nextRecommendedAction?: {
    id: string;
    label: string;
    type: "continue" | "apply" | "adjust" | "skip" | "confirm";
  };
  warnings?: Array<{ code: string; message: string }>;
};

export type MessagingBrief = {
  id: string;
  campaignId: string;
  primaryAngle: string;
  supportingAngles: string[];
  customerProblems: string[];
  desiredOutcomes: string[];
  approvedProofPointIds: string[];
  prohibitedClaims: string[];
  tone: string;
  callToAction: string;
  personalizationFields: string[];
  language: string;
  status: "draft" | "confirmed";
};

export type SequenceStrategy = {
  id: string;
  campaignId: string;
  messagingBriefId: string;
  status: "draft" | "confirmed";
  steps: Array<{
    id: string;
    channel: "email" | "linkedin" | "call" | "other";
    delayBusinessDays: number;
    purpose: string;
    callToAction?: string;
  }>;
};

export type CampaignReadiness = {
  offeringSelected: boolean;
  objectiveDefined: boolean;
  marketDefined: boolean;
  segmentDefined: boolean;
  personasDefined: boolean;
  qualificationDefined: boolean;
  discoveryStrategyConfirmed: boolean;
};

export function calculateCampaignReadiness(input: {
  offeringId: string;
  goal: string;
  markets: string;
  segment: string;
  personas: string;
  qualification: string;
  discoveryStrategy: string;
}): CampaignReadiness {
  return {
    offeringSelected: Boolean(input.offeringId.trim()),
    objectiveDefined: Boolean(input.goal.trim()),
    marketDefined: Boolean(input.markets.trim()),
    segmentDefined: Boolean(input.segment.trim()),
    personasDefined: Boolean(input.personas.trim()),
    qualificationDefined: Boolean(input.qualification.trim()),
    discoveryStrategyConfirmed: Boolean(input.discoveryStrategy.trim()),
  };
}

export function parseAiGuidedResponse(value: unknown): AiGuidedResponse {
  const row = record(value, "guided response");
  const context = record(row.context, "guided context");
  const result: AiGuidedResponse = {
    message: requiredString(row.message, "message"),
    context: {
      scope: oneOf(context.scope, guidedScopes, "context.scope"),
      ...optionalStringFields(context, ["companyProfileId", "offeringId", "campaignId"]),
    },
  };
  if (row.question !== undefined) result.question = parseQuestion(row.question);
  if (row.proposedChanges !== undefined) {
    if (!Array.isArray(row.proposedChanges))
      throw new Error("proposedChanges must be an array.");
    result.proposedChanges = row.proposedChanges.map(parseProposedChange);
  }
  if (row.summaryCard !== undefined) {
    const card = record(row.summaryCard, "summaryCard");
    if (!Array.isArray(card.items))
      throw new Error("summaryCard.items must be an array.");
    const items: StructuredSummaryItem[] = card.items.map((item) => {
      const summary = record(item, "summary item");
      const value = summary.value;
      if (
        typeof value !== "string" &&
        !(Array.isArray(value) && value.every((entry) => typeof entry === "string"))
      )
        throw new Error("Invalid summary item value.");
      const status =
        summary.status !== undefined
          ? oneOf(
              summary.status,
              ["suggested", "selected", "applied", "saved", "needs_review"] as const,
              "summary item status",
            )
          : undefined;
      return {
        label: requiredString(summary.label, "summary item label"),
        value,
        ...(status ? { status } : {}),
      };
    });
    result.summaryCard = {
      title: requiredString(card.title, "summaryCard.title"),
      items,
    };
  }
  if (row.warnings !== undefined) {
    if (!Array.isArray(row.warnings)) throw new Error("warnings must be an array.");
    result.warnings = row.warnings.map((warning) => {
      const item = record(warning, "warning");
      return {
        code: requiredString(item.code, "warning.code"),
        message: requiredString(item.message, "warning.message"),
      };
    });
  }
  return result;
}

export function parseProposedChange(value: unknown): ProposedChange {
  const row = record(value, "proposed change");
  const operation = oneOf(row.operation, proposedOperations, "operation");
  const fieldPath = optionalString(row.fieldPath);
  if (operation !== "create" && !fieldPath)
    throw new Error("A non-create proposed change requires fieldPath.");
  const confidence =
    row.confidence !== undefined
      ? oneOf(row.confidence, ["high", "medium", "low"] as const, "confidence")
      : undefined;
  return {
    id: requiredString(row.id, "proposal.id"),
    operation,
    entityType: oneOf(row.entityType, proposedEntityTypes, "entityType"),
    ...(optionalString(row.entityId) ? { entityId: optionalString(row.entityId) } : {}),
    ...(fieldPath ? { fieldPath } : {}),
    ...(row.previousValue !== undefined ? { previousValue: row.previousValue } : {}),
    proposedValue: row.proposedValue,
    ...(optionalString(row.reason) ? { reason: optionalString(row.reason) } : {}),
    ...(confidence ? { confidence } : {}),
    requiresConfirmation: row.requiresConfirmation === true,
  };
}

function parseQuestion(value: unknown): GuidedQuestion {
  const row = record(value, "guided question");
  return {
    id: requiredString(row.id, "question.id"),
    title: requiredString(row.title, "question.title"),
    ...(optionalString(row.description)
      ? { description: optionalString(row.description) }
      : {}),
    inputType: oneOf(row.inputType, guidedInputTypes, "question.inputType"),
    ...(Array.isArray(row.options)
      ? {
          options: row.options.map((option) => {
            const item = record(option, "question option");
            return {
              id: requiredString(item.id, "option.id"),
              label: requiredString(item.label, "option.label"),
              ...(optionalString(item.description)
                ? { description: optionalString(item.description) }
                : {}),
              ...(item.recommended === true ? { recommended: true } : {}),
            };
          }),
        }
      : {}),
    allowOther: row.allowOther === true,
    allowFreeTextExplanation: row.allowFreeTextExplanation === true,
    required: row.required === true,
    ...(Array.isArray(row.targetFieldPaths) &&
    row.targetFieldPaths.every((item) => typeof item === "string")
      ? { targetFieldPaths: row.targetFieldPaths }
      : {}),
  };
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} must be a non-empty string.`);
  return value.trim().slice(0, 5_000);
}
function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function optionalStringFields(row: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = optionalString(row[field]);
      return value ? [[field, value]] : [];
    }),
  );
}
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error(`Invalid ${field}.`);
  return value as T;
}

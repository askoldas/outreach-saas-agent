type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

type ProviderExecutionTelemetryRow = {
  actual_cost: number;
  completed_at: string | null;
  error_code: string | null;
  id: string;
  input_units: number | null;
  metadata: JsonValue;
  operation: string;
  output_units: number | null;
  provider: string;
  provider_cost: number | null;
  provider_currency: string | null;
  started_at: string | null;
  status: string;
};

type AiRequestTelemetryRow = {
  actual_cost: number;
  completed_at: string | null;
  currency: string;
  input_units: number | null;
  metadata: JsonValue;
  output_units: number | null;
  provider: string;
  selected_model: string;
  started_at: string | null;
  status: string;
};

export function aggregateCampaignRunTelemetry(input: {
  aiRequests: AiRequestTelemetryRow[];
  candidateStatuses: string[];
  providerExecutions: ProviderExecutionTelemetryRow[];
  qualificationStatuses: string[];
  rawCandidateCount: number;
  searchProviders: string[];
}) {
  const acceptedStatuses = new Set(["highly_relevant", "qualified", "possible"]);
  const rejectedStatuses = new Set(["insufficient_evidence", "not_relevant", "excluded"]);
  const retryCount = input.providerExecutions.reduce(
    (sum, execution) =>
      sum + arrayValue(recordValue(execution.metadata).attemptFailures).length,
    0,
  );
  return {
    providerRequestCount: input.aiRequests.length + input.searchProviders.length,
    searchRequestCount: input.searchProviders.length,
    inputTokens: sumNullable(input.aiRequests.map((request) => request.input_units)),
    outputTokens: sumNullable(input.aiRequests.map((request) => request.output_units)),
    rawCandidateCount: input.rawCandidateCount,
    classifiedCandidateCount: input.candidateStatuses.length,
    acceptedCandidateCount: input.qualificationStatuses.filter((status) =>
      acceptedStatuses.has(status),
    ).length,
    rejectedCandidateCount: input.qualificationStatuses.filter((status) =>
      rejectedStatuses.has(status),
    ).length,
    duplicateCandidateCount: input.candidateStatuses.filter(
      (status) => status === "duplicate",
    ).length,
    providerRetryCount: retryCount,
    failureCategories: counts(
      input.providerExecutions
        .map((execution) => execution.error_code)
        .filter((value): value is string => Boolean(value)),
    ),
    requestDurationsMs: [
      ...input.providerExecutions.map((execution) => ({
        durationMs: durationMs(execution.started_at, execution.completed_at),
        operation: execution.operation,
        provider: execution.provider,
      })),
      ...input.aiRequests.map((request) => ({
        durationMs: durationMs(request.started_at, request.completed_at),
        operation: "ai_request",
        provider: `${request.provider}:${request.selected_model}`,
      })),
    ].filter((item) => item.durationMs !== null),
    costObservations: [
      ...input.providerExecutions
        .filter((execution) => execution.provider_cost !== null)
        .map((execution) => ({
          amount: execution.provider_cost ?? 0,
          currency: execution.provider_currency ?? "unknown",
          operation: execution.operation,
          source: "provider_execution",
        })),
      ...input.aiRequests.map((request) => ({
        amount: Number(request.actual_cost) || 0,
        currency: request.currency,
        operation: "ai_request",
        source: "ai_request",
      })),
    ],
  };
}

function counts(values: string[]) {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

function durationMs(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return null;
  const value = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function sumNullable(values: Array<number | null>) {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function recordValue(value: JsonValue): Record<string, JsonValue | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

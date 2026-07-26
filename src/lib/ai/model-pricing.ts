export type ModelPrice = {
  model: string;
  currency: "USD";
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  version: string;
};

// Intentionally empty until prices are verified and versioned against provider terms.
// Provider-reported OpenRouter cost is preserved independently by the transport.
export const modelPricing: readonly ModelPrice[] = [];

export function estimateModelCost(input: {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const price = modelPricing.find((entry) => entry.model === input.model);
  if (!price) return undefined;
  return {
    amount:
      ((input.inputTokens ?? 0) * price.inputPerMillionTokens +
        (input.outputTokens ?? 0) * price.outputPerMillionTokens) /
      1_000_000,
    currency: price.currency,
    estimate: true as const,
    pricingVersion: price.version,
  };
}

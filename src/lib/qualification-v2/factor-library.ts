import type { FactorDefinition } from "./contracts.ts";

export const STANDARD_FACTOR_LIBRARY_VERSION = "qualification-factors-v2.1";

export const STANDARD_FACTOR_LIBRARY: readonly FactorDefinition[] = [
  {
    key: "business_model_compatibility",
    label: "Business-model compatibility",
    purposes: ["fit", "relationship"],
    weight: 1,
    criticality: "required",
    unknownPolicy: "requires_research_if_required",
  },
  {
    key: "offering_use_compatibility",
    label: "Offering-use compatibility",
    purposes: ["fit", "eligibility"],
    weight: 1.2,
    criticality: "required",
    unknownPolicy: "requires_research_if_required",
  },
  {
    key: "problem_need_compatibility",
    label: "Problem or need compatibility",
    purposes: ["fit"],
    weight: 1,
    criticality: "important",
    unknownPolicy: "reduce_confidence_only",
  },
  {
    key: "transaction_model_compatibility",
    label: "Transaction-model compatibility",
    purposes: ["fit", "eligibility"],
    weight: 0.9,
    criticality: "important",
    unknownPolicy: "reduce_confidence_only",
  },
  {
    key: "procurement_compatibility",
    label: "Procurement compatibility",
    purposes: ["fit", "relationship", "eligibility"],
    weight: 1,
    criticality: "required",
    unknownPolicy: "requires_research_if_required",
  },
  {
    key: "account_scale",
    label: "Account scale",
    purposes: ["commercial_potential"],
    weight: 1,
    criticality: "supporting",
    unknownPolicy: "reduce_confidence_only",
  },
  {
    key: "geographic_reach",
    label: "Geographic reach",
    purposes: ["commercial_potential"],
    weight: 0.8,
    criticality: "supporting",
    unknownPolicy: "reduce_confidence_only",
  },
  {
    key: "trigger_strength",
    label: "Current commercial trigger",
    purposes: ["commercial_potential"],
    weight: 0.7,
    criticality: "supporting",
    unknownPolicy: "reduce_confidence_only",
  },
] as const;

export function compileFactorLibrary(keys: string[]): FactorDefinition[] {
  const requested = new Set(keys);
  return STANDARD_FACTOR_LIBRARY.filter((factor) => requested.has(factor.key)).map(
    (factor) => ({ ...factor, purposes: [...factor.purposes] }),
  );
}

type JsonObject = Record<string, unknown>;

export function normalizeLegacyProfileBuyerRuleScopes(
  value: unknown,
  offeringKeys: ReadonlySet<string>,
) {
  const buyerLogic = objectValue(value);
  if (!buyerLogic || !Array.isArray(buyerLogic.proposedOfferingRules)) return value;

  return {
    ...buyerLogic,
    proposedOfferingRules: buyerLogic.proposedOfferingRules.map((item) =>
      normalizeRule(item, offeringKeys),
    ),
  };
}

function normalizeRule(value: unknown, offeringKeys: ReadonlySet<string>) {
  const rule = objectValue(value);
  if (
    !rule ||
    !["campaign", "candidate"].includes(String(rule.scope)) ||
    rule.source !== "ai" ||
    !["proposed", "provisional"].includes(String(rule.status))
  ) {
    return value;
  }

  const applicability = objectValue(rule.applicability);
  const matchingOfferingKeys = Array.isArray(applicability?.offeringIds)
    ? [
        ...new Set(
          applicability.offeringIds.filter(
            (item): item is string =>
              typeof item === "string" && offeringKeys.has(item),
          ),
        ),
      ]
    : [];

  return {
    ...rule,
    scope: matchingOfferingKeys.length === 1 ? "offering" : "workspace",
  };
}

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

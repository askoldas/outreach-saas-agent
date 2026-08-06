import {
  campaignRelationshipTypeSchema,
  campaignRuleConditionSchema,
  campaignStrategyV2Schema,
  type CampaignStrategyV2,
} from "../intelligence/campaign-strategy-v2/schemas.ts";
import type {
  IntelligenceMemory,
  MemoryEffect,
} from "../intelligence/contracts/memory.ts";
import { intelligenceRuleSchema } from "../intelligence/contracts/rules.ts";

export const MEMORY_EFFECT_COMPILER_VERSION = "memory-effect-compiler/v1.0";

export function compileMemoryEffects(input: {
  strategy: CampaignStrategyV2;
  memories: IntelligenceMemory[];
}) {
  const strategy = structuredClone(input.strategy);
  const trace: Array<{
    memoryId: string;
    effectType: MemoryEffect["type"];
    changedLayers: string[];
  }> = [];
  const entityResolutionEffects: Array<{ memoryId: string; effect: MemoryEffect }> = [];
  for (const memory of input.memories) {
    const effect = memory.effect;
    if (!effect) continue;
    const changedLayers: string[] = [];
    const matches = (archetypeId: string) =>
      !memory.applicability?.archetypeIds?.length ||
      memory.applicability.archetypeIds.includes(archetypeId);
    switch (effect.type) {
      case "hard_exclusion": {
        const rule = intelligenceRuleSchema.parse(effect.rule);
        if (rule.ruleType !== "hard_exclusion" || rule.strength !== "hard") {
          throw new Error("A hard-exclusion Memory must contain a hard exclusion rule.");
        }
        strategy.campaignRules = uniqueRules([...strategy.campaignRules, rule]);
        strategy.qualificationPolicy.hardExclusionRules = uniqueRules([
          ...strategy.qualificationPolicy.hardExclusionRules,
          rule,
        ]);
        strategy.discoverySegments = strategy.discoverySegments.map((segment) =>
          matches(segment.archetypeId)
            ? {
                ...segment,
                exclusionRules: uniqueRules([...segment.exclusionRules, rule]),
              }
            : segment,
        );
        changedLayers.push("strategy", "discovery", "qualification");
        break;
      }
      case "required_condition":
      case "preferred_condition": {
        const condition = campaignRuleConditionSchema.parse(effect.condition);
        const field =
          effect.type === "required_condition"
            ? "requiredConditions"
            : "preferredConditions";
        strategy.archetypes = strategy.archetypes.map((archetype) =>
          matches(archetype.id)
            ? {
                ...archetype,
                [field]: uniqueConditions([...archetype[field], condition]),
              }
            : archetype,
        );
        changedLayers.push("strategy", "research", "qualification");
        break;
      }
      case "soft_exclusion": {
        const condition = campaignRuleConditionSchema.parse(effect.condition);
        strategy.archetypes = strategy.archetypes.map((archetype) =>
          matches(archetype.id)
            ? {
                ...archetype,
                negativeConditions: uniqueConditions([
                  ...archetype.negativeConditions,
                  condition,
                ]),
              }
            : archetype,
        );
        changedLayers.push("strategy", "qualification");
        break;
      }
      case "query_term_include":
        strategy.discoverySegments = strategy.discoverySegments.map((segment) =>
          matches(segment.archetypeId)
            ? {
                ...segment,
                businessCharacteristics: {
                  ...segment.businessCharacteristics,
                  keywords: sortedUnique([
                    ...segment.businessCharacteristics.keywords,
                    ...effect.terms,
                  ]),
                },
              }
            : segment,
        );
        changedLayers.push("queries");
        break;
      case "query_term_exclude": {
        const rule = memoryQueryExclusionRule(memory);
        strategy.discoverySegments = strategy.discoverySegments.map((segment) =>
          matches(segment.archetypeId)
            ? {
                ...segment,
                exclusionRules: uniqueRules([...segment.exclusionRules, rule]),
              }
            : segment,
        );
        changedLayers.push("queries");
        break;
      }
      case "source_preference":
        strategy.sourcePlan.primaryProviderTypes = orderedUnique([
          ...effect.sourceTypes,
          ...strategy.sourcePlan.primaryProviderTypes,
        ]);
        changedLayers.push("strategy", "discovery");
        break;
      case "relationship_correction": {
        const relationshipType = campaignRelationshipTypeSchema.parse(
          effect.relationshipType,
        );
        strategy.archetypes = strategy.archetypes.map((archetype) =>
          matches(archetype.id) ? { ...archetype, relationshipType } : archetype,
        );
        strategy.discoverySegments = strategy.discoverySegments.map((segment) =>
          matches(segment.archetypeId) ? { ...segment, relationshipType } : segment,
        );
        changedLayers.push("strategy", "queries", "qualification");
        break;
      }
      case "organization_alias":
      case "entity_resolution_correction":
        entityResolutionEffects.push({ memoryId: memory.id, effect });
        changedLayers.push("entity_resolution");
        break;
    }
    trace.push({ memoryId: memory.id, effectType: effect.type, changedLayers });
  }
  return {
    strategy: campaignStrategyV2Schema.parse(strategy),
    entityResolutionEffects,
    trace,
    compilerVersion: MEMORY_EFFECT_COMPILER_VERSION,
  };
}

export function applyMemoryEntityResolutionEffects<
  T extends {
    name: string;
    normalizedName: string | null;
    canonicalDomainHint: string | null;
  },
>(candidates: T[], effects: Array<{ memoryId: string; effect: MemoryEffect }>): T[] {
  return candidates.map((candidate) => {
    let result = { ...candidate };
    for (const { effect } of effects) {
      if (effect.type === "organization_alias") {
        if (!effect.aliases.some((alias) => sameName(alias, result.name))) continue;
        result = {
          ...result,
          name: effect.canonicalName,
          normalizedName: normalizeName(effect.canonicalName),
        };
      }
      if (effect.type === "entity_resolution_correction") {
        if (!effect.action.matchNames.some((name) => sameName(name, result.name))) {
          continue;
        }
        result = {
          ...result,
          name: effect.action.canonicalName,
          normalizedName: normalizeName(effect.action.canonicalName),
          ...(effect.action.canonicalDomain
            ? { canonicalDomainHint: effect.action.canonicalDomain }
            : {}),
        };
      }
    }
    return result;
  });
}

function memoryQueryExclusionRule(memory: IntelligenceMemory) {
  if (memory.effect?.type !== "query_term_exclude") throw new Error("Invalid effect.");
  return intelligenceRuleSchema.parse({
    ruleKey: `memory.query.exclude.${memory.id}`,
    label: "Memory query-term exclusion",
    description: memory.effect.terms.join(" | "),
    ruleType: "soft_exclusion",
    scope: "campaign",
    strength: "soft",
    applicability: {
      objectives: memory.applicability?.objectiveCodes ?? [],
      offeringIds: memory.applicability?.offeringIds ?? [],
      geographies: memory.applicability?.geographyCodes ?? [],
      relationshipTypes: memory.applicability?.relationshipTypes ?? [],
      archetypeIds: memory.applicability?.archetypeIds ?? [],
    },
    status: "confirmed",
    source: "system",
    evidenceIds: memory.evidenceIds,
    confidence: memory.confidence,
  });
}

function uniqueRules<T extends { ruleKey: string }>(values: T[]) {
  return [...new Map(values.map((value) => [value.ruleKey, value])).values()];
}

function uniqueConditions<T extends { field: string; operator: string; value?: unknown }>(
  values: T[],
) {
  return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
}

function sortedUnique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function orderedUnique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function sameName(left: string, right: string) {
  return normalizeName(left) === normalizeName(right);
}

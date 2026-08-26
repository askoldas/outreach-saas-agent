import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  profileBuyerLogicOutputSchema,
  profileClarificationOutputSchema,
  profileCommercialSynthesisOutputSchema,
  profileConsistencyOutputSchema,
  profileOfferingDecompositionOutputSchema,
} from "./task-contracts.ts";

type Commercial = z.infer<typeof profileCommercialSynthesisOutputSchema>;
type Offerings = z.infer<typeof profileOfferingDecompositionOutputSchema>;
type BuyerLogic = z.infer<typeof profileBuyerLogicOutputSchema>;
type Clarification = z.infer<typeof profileClarificationOutputSchema>;
type Consistency = z.infer<typeof profileConsistencyOutputSchema>;

export type ProfileV3CompilationInput = {
  workspaceId: string;
  profileDraftId: string;
  companyProfileId: string;
  baseSnapshot: unknown;
  commercial: Commercial;
  offerings: Offerings;
  buyerLogic: BuyerLogic;
  clarification: Clarification;
  consistency: Consistency;
};

export function compileProfileV3Draft(input: ProfileV3CompilationInput) {
  const offeringKeys = new Set(input.offerings.offerings.map((item) => item.offeringKey));
  if (offeringKeys.size !== input.offerings.offerings.length) {
    throw new Error("Offering decomposition returned duplicate offering keys.");
  }
  const buyerLogicByOffering = new Map(
    input.buyerLogic.offeringBuyerLogic.map((logic) => [logic.offeringKey, logic]),
  );
  for (const key of buyerLogicByOffering.keys()) {
    if (!offeringKeys.has(key)) {
      throw new Error(`Buyer logic references unknown offering ${key}.`);
    }
  }
  const missingBuyerLogic = [...offeringKeys].filter(
    (key) => !buyerLogicByOffering.has(key),
  );
  if (missingBuyerLogic.length) {
    throw new Error(
      `Active offering(s) have no usable buyer logic: ${missingBuyerLogic.join(", ")}.`,
    );
  }
  const archetypesByOffering = new Map<string, BuyerLogic["archetypes"]>();
  const archetypeKeys = new Set<string>();
  for (const archetype of input.buyerLogic.archetypes) {
    if (!offeringKeys.has(archetype.offeringKey)) {
      throw new Error(
        `Buyer archetype ${archetype.archetypeKey} references unknown offering ${archetype.offeringKey}.`,
      );
    }
    const archetypeKey = uniqueScopedKey(
      archetype.archetypeKey,
      archetype.offeringKey,
      archetypeKeys,
    );
    const normalizedArchetype = { ...archetype, archetypeKey };
    archetypeKeys.add(archetypeKey);
    const entries = archetypesByOffering.get(archetype.offeringKey) ?? [];
    entries.push(normalizedArchetype);
    archetypesByOffering.set(archetype.offeringKey, entries);
  }

  const normalizedBuyerLogic = {
    ...input.buyerLogic,
    archetypes: [...archetypesByOffering.values()].flat(),
  };

  const offerings = input.offerings.offerings.map((offering) => ({
    stableKey: offering.offeringKey,
    slug: slugify(offering.offeringKey || offering.name),
    name: offering.name,
    status: offering.confidence >= 0.5 ? "active" : "uncertain",
    offeringType: offering.offeringType,
    shortDescription: offering.shortDescription,
    commercialMechanics: {
      buyingMotion: offering.buyingMotion,
      customerConsumptionMode: offering.customerConsumptionMode,
      dependencies: offering.dependencies,
      includedItemKeys: offering.includedItemKeys,
      excludedItemKeys: offering.excludedItemKeys,
      valueProposition: offering.valueProposition,
      customerProblems: offering.customerProblems,
      expectedOutcomes: offering.expectedOutcomes,
    },
    buyerLogic: buyerLogicByOffering.get(offering.offeringKey)!,
    relationshipOptions: (archetypesByOffering.get(offering.offeringKey) ?? []).map(
      (archetype) => ({
        relationshipType: archetype.relationshipType,
        relevance:
          archetype.priority === "priority"
            ? "primary"
            : archetype.priority === "conditional"
              ? "possible"
              : "avoid",
        rationale: archetype.whyCompatible.join(" "),
        confidence: archetype.confidence,
      }),
    ),
    constraints: offering.commercialConstraints,
    confidence: offering.confidence,
    evidenceIds: validUuids(offering.evidenceIds),
    archetypes: (archetypesByOffering.get(offering.offeringKey) ?? []).map(
      (archetype) => ({
        archetypeKey: archetype.archetypeKey,
        name: archetype.name,
        relationshipType: archetype.relationshipType,
        priority:
          archetype.priority === "exclude_by_default" ? "avoid" : archetype.priority,
        status: "proposed",
        details: {
          description: archetype.description,
          whyCompatible: archetype.whyCompatible,
          requiredEvidence: archetype.requiredEvidence,
          positiveSignals: archetype.positiveSignals,
          negativeSignals: archetype.negativeSignals,
          likelyDecisionRoles: archetype.likelyDecisionRoles,
          epistemicStatus: archetype.epistemicStatus,
        },
        confidence: archetype.confidence,
        evidenceIds: validUuids(archetype.evidenceIds),
      }),
    ),
  }));

  const rules = input.buyerLogic.proposedOfferingRules.map((rule) => {
    if (rule.scope !== "workspace" && rule.scope !== "offering") {
      throw new Error(`Profile rule ${rule.ruleKey} has invalid scope ${rule.scope}.`);
    }
    const offeringKey =
      rule.scope === "offering" ? rule.applicability.offeringIds[0] : undefined;
    if (offeringKey && !offeringKeys.has(offeringKey)) {
      throw new Error(`Profile rule ${rule.ruleKey} references unknown offering.`);
    }
    if (rule.scope === "offering" && !offeringKey) {
      throw new Error(`Profile rule ${rule.ruleKey} has no offering.`);
    }
    return {
      ruleKey: rule.ruleKey,
      scope: rule.scope,
      offeringKey,
      ruleType: rule.ruleType,
      strength: rule.strength,
      status: "proposed",
      source: rule.source === "campaign" ? "ai" : rule.source,
      description: rule.description,
      applicability: rule.applicability,
      confidence: rule.confidence,
      evidenceIds: validUuids(rule.evidenceIds),
    };
  });

  const compiledSnapshot = {
    ...objectValue(input.baseSnapshot),
    commercialSynthesis: input.commercial,
    offerings: input.offerings,
    buyerLogic: normalizedBuyerLogic,
    clarification: input.clarification,
    consistency: input.consistency,
  };

  return {
    workspaceId: input.workspaceId,
    profileDraftId: input.profileDraftId,
    companyProfileId: input.companyProfileId,
    businessModel: {
      primaryRole: input.commercial.primaryRoles[0]?.role ?? null,
      revenueModel: input.commercial.revenueMechanics[0]?.mechanism ?? null,
      transactionModel: input.commercial.transactionModels[0] ?? null,
      customerUsageMode: input.commercial.customerConsumptionModes[0] ?? null,
      salesMotion: input.commercial.channelModels[0] ?? null,
      confidence: average(input.commercial.primaryRoles.map((role) => role.confidence)),
      details: input.commercial,
      roles: input.commercial.primaryRoles.map((role) => ({
        roleType: role.role,
        priority: role.importance,
        confidence: role.confidence,
        evidenceIds: validUuids(role.evidenceIds),
      })),
    },
    offerings,
    rules,
    questions: input.clarification.questions,
    compiledSnapshot,
    compiledSnapshotHash: hash(compiledSnapshot),
  };
}

function uniqueScopedKey(baseKey: string, offeringKey: string, used: Set<string>) {
  if (!used.has(baseKey)) return baseKey;
  let sequence = 1;
  while (true) {
    const suffix = `--${offeringKey}${sequence === 1 ? "" : `-${sequence}`}`;
    const candidate = `${baseKey.slice(0, 160 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
    sequence += 1;
  }
}

function validUuids(values: string[]) {
  return [
    ...new Set(values.filter((value) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value))),
  ];
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "offering"
  );
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

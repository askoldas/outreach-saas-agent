import type { CompanyIntelligenceV3 } from "./schemas.ts";

export type ProfileV3Readiness = {
  publishable: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
};

export function evaluateProfileV3Readiness(
  profile: CompanyIntelligenceV3,
): ProfileV3Readiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const activeOfferings = profile.offerings.filter((item) => item.status === "active");

  if (!profile.identity.publicName.trim() || !profile.identity.canonicalDomain.trim()) {
    blockers.push("Company identity requires a public name and canonical domain.");
  }
  if (!profile.businessModel.summary.trim()) {
    blockers.push("Company business model requires a usable summary.");
  }
  if (activeOfferings.length === 0) {
    blockers.push("At least one offering must be explicitly active.");
  }
  for (const offering of activeOfferings) {
    if (offering.commercialMechanics.transactionModels.length === 0) {
      blockers.push(`${offering.name} requires a basic transaction model.`);
    }
    if (offering.relationshipOptions.length === 0) {
      blockers.push(`${offering.name} requires at least one relationship hypothesis.`);
    }
    if (offering.buyerLogic.whyBuy.length === 0) {
      warnings.push(`${offering.name} has no supported purchase rationale.`);
    }
    if (offering.commercialMechanics.purchaseMotion === "unknown") {
      warnings.push(`${offering.name} has an unknown purchase motion.`);
    }
  }
  if (profile.unresolvedCriticalConflictIds.length > 0) {
    blockers.push("Critical claim conflicts must be resolved or accepted as unknown.");
  }
  if (profile.legacyImport?.requiresUserReview) {
    blockers.push("Legacy-imported intelligence requires explicit user review.");
  }

  const checks = [
    Boolean(profile.identity.publicName && profile.identity.canonicalDomain),
    Boolean(profile.businessModel.summary),
    activeOfferings.length > 0,
    activeOfferings.every(
      (item) =>
        item.commercialMechanics.transactionModels.length > 0 &&
        item.relationshipOptions.length > 0,
    ),
    profile.unresolvedCriticalConflictIds.length === 0,
    !profile.legacyImport,
  ];

  return {
    publishable: blockers.length === 0,
    score: Math.max(
      0,
      Math.round(
        (checks.filter(Boolean).length / checks.length) * 100 -
          Math.min(warnings.length * 3, 15),
      ),
    ),
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}

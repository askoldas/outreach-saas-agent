import type {
  BusinessModelType,
  Offering,
  StructuredCompanyProfile,
} from "../../company-profile/structured-profile.ts";
import { companyIntelligenceV3Schema, type CompanyIntelligenceV3 } from "./schemas.ts";

export function adaptV2ProfileToV3Draft(input: {
  workspaceId: string;
  profileVersionId: string;
  profile: StructuredCompanyProfile;
}): CompanyIntelligenceV3 {
  const { workspaceId, profileVersionId, profile } = input;
  const offerings = profile.offerings
    .filter((item) => item.status !== "rejected" && item.status !== "excluded")
    .slice(0, 12)
    .map((offering) => adaptOffering(profileVersionId, offering));

  return companyIntelligenceV3Schema.parse({
    schemaVersion: 3,
    profileVersionId,
    status: "draft",
    identity: {
      id: `identity-${workspaceId}`,
      workspaceId,
      publicName: profile.name,
      legalName: profile.legalName,
      tradingNames: [],
      brands: [],
      canonicalDomain: domainFromUrl(profile.websiteUrl),
      additionalDomains: [],
      operatingLocations: [],
      marketsServed: [],
      primaryLanguage: profile.supportedLanguages[0],
      supportedLanguages: profile.supportedLanguages,
    },
    businessModel: {
      summary: profile.shortOverview,
      roles: profile.businessModels.map((model, index) => ({
        role: mapBusinessRole(model),
        importance: index === 0 ? "primary" : "secondary",
        confidence: 0.35,
        evidenceIds: [],
        explanation: "Imported from the V2 business-model classification for review.",
      })),
      valueCreation: profile.capabilities.map((item) => item.name),
      valueDelivery: [],
      valueCapture: [],
      customerRelationshipModels: profile.customerLandscape?.relationshipTypes ?? [],
      salesMotions: [],
      revenuePatterns: [],
      sellsForOwnUse: null,
      sellsForResale: null,
      sellsThroughPartners: null,
      directSalesImportance: "unknown",
      channelSalesImportance: "unknown",
      constraints: [],
      confidence: 0.25,
      evidenceIds: [],
    },
    offerings,
    buyerArchetypes: [],
    rules: [
      ...(profile.commercialConstraints ?? []),
      ...(profile.regulatoryLimitations ?? []),
    ].map((statement, index) => ({
      ruleKey: `legacy.profile-constraint-${index + 1}`,
      label: statement.slice(0, 120),
      description: statement,
      ruleType: "requirement",
      scope: "workspace",
      strength: "soft",
      applicability: {
        objectives: [],
        offeringIds: [],
        geographies: [],
        relationshipTypes: [],
        archetypeIds: [],
      },
      status: "proposed",
      source: "profile",
      evidenceIds: [],
      confidence: 0.25,
    })),
    unresolvedCriticalConflictIds: [],
    legacyImport: {
      sourceSchemaVersion: 2,
      requiresUserReview: true,
      warnings: [
        "Legacy values were imported as provisional draft intelligence.",
        "No legacy value was upgraded to a confirmed fact.",
        ...(profile.offerings.length > offerings.length
          ? ["Some rejected, excluded, or excess legacy offerings were not imported."]
          : []),
      ],
    },
  });
}

function adaptOffering(profileVersionId: string, offering: Offering) {
  const id = `offering-${profileVersionId}-${slug(offering.id || offering.name)}`;
  const customerUseMode = mapUseMode(offering);
  return {
    id,
    profileVersionId,
    name: offering.name,
    slug: slug(offering.name),
    shortDescription: offering.shortDescription || offering.name,
    offeringType: mapOfferingType(offering),
    variants: [],
    customerProblem: offering.customerProblems,
    promisedOutcomes: offering.expectedOutcomes,
    useCases: offering.useCases,
    commercialMechanics: {
      transactionModels: mapTransactions(offering),
      purchaseMotion: "unknown" as const,
      customerUseMode,
      typicalRelationship: "unknown" as const,
      confidence: 0.2,
      evidenceIds: [],
    },
    buyerLogic: {
      whyBuy: offering.expectedOutcomes,
      buyingTriggers: [],
      requiredCapabilities: offering.qualificationRequirements.map((statement, index) =>
        condition(`legacy-required-${index + 1}`, statement, "required"),
      ),
      preferredCharacteristics: [],
      incompatibleCharacteristics: offering.disqualifyingConditions.map(
        (statement, index) =>
          condition(`legacy-incompatible-${index + 1}`, statement, "incompatible"),
      ),
      buyerRoles: offering.buyerPersonas.map((persona) => ({
        roleType: mapBuyerRole(persona.roleInDecision),
        jobFunctions: [persona.titleGroup, ...persona.exampleTitles],
        relevance: "conditional" as const,
        confidence: 0.25,
        evidenceIds: [],
      })),
      procurementModel: {
        motion: "unknown" as const,
        participants: [],
        confidence: 0,
        evidenceIds: [],
      },
      likelyAlternatives: [],
      likelyObjections: [],
      positiveEvidenceSignals: [],
      negativeEvidenceSignals: [],
      confidence: 0.2,
      evidenceIds: [],
    },
    relationshipOptions: [
      {
        relationshipType: mapRelationship(customerUseMode),
        relevance: "possible" as const,
        rationale: "Provisional relationship inferred from legacy customer-use fields.",
        requiredConditions: [],
        incompatibleConditions: [],
        confidence: 0.2,
        evidenceIds: [],
      },
    ],
    availability: { geographies: [], excludedGeographies: [], notes: [] },
    constraints: offering.commercialConstraints.map((statement, index) => ({
      key: `legacy.offering-constraint-${index + 1}`,
      statement,
      scope: "offering" as const,
      scopeId: id,
      strength: "soft" as const,
      status: "proposed" as const,
      confidence: 0.25,
      evidenceIds: [],
    })),
    status: "uncertain" as const,
    confidence: 0.25,
    claimIds: [],
    evidenceIds: [],
  };
}

function condition(key: string, statement: string, type: "required" | "incompatible") {
  return {
    key,
    statement,
    conditionType: type,
    conditions: [],
    confidence: 0.25,
    evidenceIds: [],
  };
}

function mapBusinessRole(model: BusinessModelType) {
  const roles: Record<BusinessModelType, string> = {
    saas_software: "software_provider",
    professional_service: "service_provider",
    agency_consultancy: "consultancy",
    manufacturer: "manufacturer",
    contract_manufacturer: "manufacturer",
    distributor_wholesaler: "distributor",
    partnership_licensing: "other",
    marketplace: "marketplace",
    other: "other",
  };
  return roles[model];
}

function mapOfferingType(offering: Offering) {
  const value = `${offering.offeringType} ${offering.businessModel}`.toLowerCase();
  if (value.includes("software") || value.includes("saas")) return "software";
  if (value.includes("subscription")) return "subscription";
  if (value.includes("manufacturer") || value.includes("product"))
    return "physical_product";
  if (value.includes("wholesale") || value.includes("distributor"))
    return "wholesale_supply";
  if (value.includes("marketplace")) return "marketplace_access";
  if (value.includes("service") || value.includes("agency")) return "service";
  return "other";
}

function mapTransactions(offering: Offering) {
  const value = `${offering.pricingModel ?? ""} ${offering.businessModel}`.toLowerCase();
  if (value.includes("subscription") || value.includes("saas"))
    return ["subscription"] as const;
  if (value.includes("wholesale") || value.includes("distributor"))
    return ["wholesale_order"] as const;
  if (value.includes("service") || value.includes("agency"))
    return ["project_contract"] as const;
  return [];
}

function mapUseMode(offering: Offering) {
  if (offering.businessModel === "distributor_wholesaler") return "resale" as const;
  if (offering.businessModel === "contract_manufacturer")
    return "implementation_for_clients" as const;
  return "unknown" as const;
}

function mapRelationship(useMode: ReturnType<typeof mapUseMode>) {
  if (useMode === "resale") return "reseller" as const;
  if (useMode === "implementation_for_clients") return "implementation_partner" as const;
  return "direct_buyer" as const;
}

function mapBuyerRole(role: Offering["buyerPersonas"][number]["roleInDecision"]) {
  if (role === "decision_maker") return "decision_maker" as const;
  if (role === "user") return "operational_user" as const;
  if (role === "influencer") return "champion" as const;
  return "other" as const;
}

function domainFromUrl(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/[_\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "legacy-offering"
  );
}

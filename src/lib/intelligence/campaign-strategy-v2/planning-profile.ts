import type { IntelligenceRule } from "../contracts/rules.ts";

export const nativeCampaignEntryContract = "native-campaign/v1" as const;
export const nativeCampaignStrategyEntryContract = "native-campaign-strategy/v1" as const;

export type CampaignPlanningArchetype = {
  key: string;
  name: string;
  relationshipType: string;
  priority: "priority" | "conditional" | "low_priority" | "avoid";
  status: "proposed" | "user_confirmed" | "user_rejected" | "superseded";
  description: string;
  whyCompatible: string[];
  requiredEvidence: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  likelyDecisionRoles: string[];
  confidence: number;
  evidenceIds: string[];
};

export type CampaignPlanningOffering = {
  stableKey: string;
  offeringId: string;
  offeringVersionId: string;
  slug: string;
  name: string;
  offeringType: string;
  shortDescription: string;
  confidence: number;
  commercialMechanics: {
    buyingMotion: string;
    customerConsumptionMode: string;
    dependencies: string[];
    valueProposition: string[];
    customerProblems: string[];
    expectedOutcomes: string[];
    transactionModels: string[];
  };
  buyerLogic: {
    offeringKey: string;
    whyBuy: string[];
    requiredConditions: string[];
    preferredConditions: string[];
    likelyTriggers: string[];
    incompatibleConditions: string[];
    likelyDecisionRoles: string[];
    procurementPattern?: string;
    positiveEvidenceSignals: string[];
    negativeEvidenceSignals: string[];
    evidenceIds: string[];
    confidence: number;
  };
  relationshipOptions: Array<{
    relationshipType: string;
    relevance: string;
    rationale: string;
    confidence: number;
  }>;
  archetypes: CampaignPlanningArchetype[];
};

export type CampaignPlanningProfile = {
  profileVersionId: string;
  companyName: string;
  commercialSummary: string;
  primaryLanguage: string;
  supportedLanguages: string[];
  companyRoles: string[];
  offerings: CampaignPlanningOffering[];
  rules: IntelligenceRule[];
};

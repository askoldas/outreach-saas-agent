import {
  campaignBriefPromptVersion,
  parseCampaignBriefProposal,
} from "@/lib/campaign-workflow/contracts";
import type { CampaignPlanningProfile } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { generateTextResult } from "@/lib/providers/openrouter";
import { parseCompleteJsonObject } from "@/lib/ai/structured-json";

export async function generateCampaignBriefProposal(input: {
  geography: { countryCodes: string[]; regionLabel?: string };
  profile: CampaignPlanningProfile;
}) {
  if (!input.geography.countryCodes.length && !input.geography.regionLabel) {
    throw new Error("Choose at least one country or region first.");
  }
  const offerings = input.profile.offerings;
  if (!offerings.length)
    throw new Error("The Company Profile has no campaign-ready offering.");

  assertIntelligenceExternalCallsAllowed("model");
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content:
          "Propose one concise B2B campaign brief for the selected geography. The supplied profile is the published, reviewed Company Intelligence V3 graph. Select exactly one primary offering using its stableKey as the offering ID. Prefer its active buyer archetypes, relationship options, buyer logic, and confirmed commercial rules, but adapt them to the selected market and user objective. Propose one to five coherent and distinct searchable organization target segments. Consumers, families, private customers, end users, and Consumer as a standalone industry are invalid targets. Never treat decision-maker job titles as target organizations. Supporting capabilities may inform the value proposition but must not be returned as additional offering IDs. Return JSON matching the requested shape. Do not modify or contradict the frozen profile. Ask at most one focused clarification and only for a material ambiguity.",
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: campaignBriefPromptVersion,
          geography: input.geography,
          company: {
            name: input.profile.companyName,
            commercialSummary: input.profile.commercialSummary,
            companyRoles: input.profile.companyRoles,
            confirmedRules: input.profile.rules
              .filter((rule) => rule.status === "confirmed")
              .slice(0, 30),
            offerings: offerings.map((offering) => ({
              id: offering.stableKey,
              name: offering.name,
              offeringType: offering.offeringType,
              summary: offering.shortDescription,
              confidence: offering.confidence,
              commercialMechanics: offering.commercialMechanics,
              buyerLogic: offering.buyerLogic,
              relationshipOptions: offering.relationshipOptions,
              buyerArchetypes: offering.archetypes
                .filter(
                  (archetype) =>
                    archetype.status !== "user_rejected" &&
                    archetype.status !== "superseded" &&
                    archetype.priority !== "avoid",
                )
                .slice(0, 5),
            })),
          },
          requiredShape: {
            geography: { countryCodes: [], regionLabel: "", primaryLanguage: "" },
            offering: {
              profileOfferingIds: ["exactly-one-supplied-offering-id"],
              title: "",
              summary: "",
              valueProposition: "",
              rationale: "",
            },
            targetClient: {
              companyTypes: [],
              industries: [],
              employeeRange: { min: 1, max: 100 },
              characteristics: [],
              positiveSignals: [],
              requiredCriteria: [],
              exclusions: [],
              recommendedDecisionMakerRoles: [],
              summary: "",
            },
            targetSegments: [
              {
                id: "stable-segment-id",
                name: "searchable organization segment",
                summary: "",
                relationshipType:
                  "customer|partner|distributor|reseller|supplier|contractor|public_institution",
                organizationTypes: [],
                industries: [],
                companySize: { minimumEmployees: 1, maximumEmployees: 100 },
                geographies: input.geography.countryCodes,
                characteristics: [],
                buyingSignals: [],
                likelyBuyerRoles: [],
                exclusions: [],
                rationale: "",
                supportingEvidence: [],
                discoverability: "high|medium",
                source: "ai_suggested",
                confidence: "high|medium|low",
                status: "suggested",
              },
            ],
            ambiguity: { requiresClarification: false },
            confidence: 0.8,
          },
        }),
      },
    ],
    {
      role: "campaign_planning",
      taskName: "campaign brief proposal",
      jsonMode: true,
      maxCompletionTokens: 5500,
    },
  );
  return {
    proposal: parseCampaignBriefProposalOutput(
      modelCall.data,
      new Set(offerings.map((offering) => offering.stableKey)),
    ),
    promptVersion: campaignBriefPromptVersion,
    modelCall,
  };
}

export function parseCampaignBriefProposalOutput(
  rawOutput: string,
  offeringIds: ReadonlySet<string>,
) {
  const raw = parseCompleteJsonObject(rawOutput);
  if (raw === undefined) {
    throw new Error("Campaign planning returned invalid JSON.");
  }
  return parseCampaignBriefProposal(raw, offeringIds);
}

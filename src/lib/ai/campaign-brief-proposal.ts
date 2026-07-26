import type { StructuredCompanyProfile } from "@/lib/company-profile/structured-profile";
import {
  campaignBriefPromptVersion,
  parseCampaignBriefProposal,
} from "@/lib/campaign-workflow/contracts";
import { generateTextResult } from "@/lib/providers/openrouter";
import { parseCompleteJsonObject } from "@/lib/ai/structured-json";

export async function generateCampaignBriefProposal(input: {
  geography: { countryCodes: string[]; regionLabel?: string };
  profile: StructuredCompanyProfile;
}) {
  if (!input.geography.countryCodes.length && !input.geography.regionLabel) {
    throw new Error("Choose at least one country or region first.");
  }
  const offerings = input.profile.offerings.filter(
    (offering) => offering.status !== "excluded",
  );
  if (!offerings.length)
    throw new Error("The Company Profile has no campaign-ready offering.");

  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content:
          "Propose one concise B2B campaign brief for the selected geography. Select only supplied offering IDs. Return JSON matching the requested shape. Ground the proposal in the frozen Company Profile. Do not modify it. Ask at most one focused clarification and only for a material ambiguity.",
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: campaignBriefPromptVersion,
          geography: input.geography,
          company: {
            name: input.profile.name,
            overview: input.profile.shortOverview,
            customerLandscape: input.profile.customerLandscape,
            differentiators: input.profile.differentiators,
            proof: input.profile.companyProof,
            constraints: input.profile.commercialConstraints,
            offerings,
          },
          requiredShape: {
            geography: { countryCodes: [], regionLabel: "", primaryLanguage: "" },
            offering: {
              profileOfferingIds: [],
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
      maxCompletionTokens: 4000,
    },
  );
  return {
    proposal: parseCampaignBriefProposalOutput(
      modelCall.data,
      new Set(offerings.map((offering) => offering.id)),
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

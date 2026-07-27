import {
  parseTargetSegments,
  type TargetSegment,
} from "../campaign-workflow/target-segments.ts";
import type { OfferingProposal } from "./offering-proposals.ts";
import { generateTextResult } from "../providers/openrouter.ts";

export const targetSegmentProposalPromptVersion = "campaign-target-segments-v1";

export async function generateTargetSegmentProposals(input: {
  companyProfile: Record<string, unknown>;
  market: { countryCodes: string[]; regionLabel?: string };
  primaryOffering: OfferingProposal;
  supportingCapabilityIds: string[];
}) {
  const promptInput = {
    companyProfile: input.companyProfile,
    market: input.market,
    primaryOffering: input.primaryOffering,
    supportingCapabilityIds: input.supportingCapabilityIds,
    requiredOutput: { targetSegments: [targetSegmentShape] },
  };
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content: [
          "Propose three to five coherent, distinct, searchable organization target segments for one Campaign.",
          "Derive targets from the selected primary Offering, supporting capabilities, Campaign market, known proof, constraints, relationship type, and discovery feasibility.",
          "Never copy current customer groups into Campaign targets without reasoning from the selected Offering.",
          "Consumers, families, private customers, people needing a service, and demographics are not company-discovery targets.",
          "Every segment must identify an organization or public institution and one valid B2B relationship: customer, partner, distributor, reseller, supplier, contractor, or public institution.",
          "Distinguish the buyer organization, likely decision makers, and beneficiaries. Keep broad opportunities as separate coherent routes rather than one giant ICP.",
          "Use only the selected Campaign market. Do not mutate the Company Profile.",
          "Reject unsupported capabilities and low-discoverability abstractions. Return validated JSON only.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(promptInput) },
    ],
    {
      role: "campaign_planning",
      taskName: "structured campaign target segment generation",
      jsonMode: true,
      maxCompletionTokens: 6_000,
      reasoningEffort: "minimal",
    },
  );
  return {
    targetSegments: parseTargetSegmentProposalResponse(modelCall.data),
    modelCall,
    promptInput,
  };
}

export function parseTargetSegmentProposalResponse(value: unknown): TargetSegment[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Target proposal returned an invalid response.");
  }
  return parseTargetSegments((parsed as Record<string, unknown>).targetSegments);
}

const targetSegmentShape = {
  id: "stable_slug",
  name: "coherent organization segment",
  summary: "one or two sentences",
  relationshipType:
    "customer|partner|distributor|reseller|supplier|contractor|public_institution",
  organizationTypes: ["searchable organization type"],
  industries: ["coherent industry"],
  companySize: { minimumEmployees: 10, maximumEmployees: 500 },
  geographies: ["selected Campaign geography only"],
  characteristics: ["observable characteristic"],
  buyingSignals: ["researchable signal"],
  likelyBuyerRoles: ["decision maker"],
  exclusions: ["specific exclusion"],
  rationale: "why this segment fits the selected Offering",
  supportingEvidence: ["profile evidence"],
  discoverability: "high|medium|low",
  source: "ai_suggested",
  confidence: "high|medium|low",
  status: "suggested",
};

function parseJson(value: string) {
  try {
    return JSON.parse(
      value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error("Target proposal returned invalid JSON.");
  }
}

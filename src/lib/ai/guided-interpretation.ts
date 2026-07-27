import { parseAiGuidedResponse, type GuidedScope } from "../guided/contracts.ts";
import { generateTextResult } from "../providers/openrouter.ts";
import { parseCompleteJsonObject } from "./company-profile-analysis.ts";

export const guidedInterpretationPromptVersion = "guided-change-v1";

const allowedFields: Partial<Record<GuidedScope, string[]>> = {
  company: [
    "shortOverview",
    "prospectingMarkets",
    "excludedMarkets",
    "outreachLanguages",
    "offerings.<offeringId>.valueProposition",
    "offerings.<offeringId>.targetCustomerTypes",
    "offerings.<offeringId>.targetIndustries",
    "offerings.<offeringId>.targetCompanySizes",
    "offerings.<offeringId>.buyerPersonas",
    "offerings.<offeringId>.qualificationRequirements",
    "offerings.<offeringId>.disqualifyingConditions",
  ],
  campaign: [
    "targetGeography",
    "companyTypes",
    "industries",
    "qualificationCriteria",
    "exclusions",
    "contactRoles",
    "relevanceReasons",
  ],
};

export async function interpretGuidedChange(input: {
  scope: "company" | "campaign";
  entityId: string;
  request: string;
  context: Record<string, unknown>;
}) {
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content: [
          "Interpret one bounded commercial adjustment into a structured proposal.",
          "Never mutate data, invent company facts, or use fields and operations outside the supplied allowlist.",
          "Material settings require confirmation. If ambiguous, return one focused clarification question and no proposed changes.",
          "Return JSON only matching the required response contract.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          scope: input.scope,
          entityId: input.entityId,
          request: input.request,
          currentObject: input.context,
          allowedFields: allowedFields[input.scope],
          allowedOperations: ["set", "add", "remove", "replace", "merge", "classify"],
          requiredContract: {
            message: "string",
            context: { scope: input.scope, [`${input.scope}Id`]: input.entityId },
            question: "optional GuidedQuestion",
            proposedChanges: [
              {
                id: "slug",
                operation: "set|add|remove|replace|merge|classify",
                entityType:
                  input.scope === "company" ? "company_profile|offering" : "campaign",
                entityId: "optional",
                fieldPath: "one allowed field",
                previousValue: "current value",
                proposedValue: "new value",
                reason: "short reason",
                confidence: "high|medium|low",
                requiresConfirmation: true,
              },
            ],
            summaryCard: {
              title: "Interpretation",
              items: [
                { label: "field label", value: "structured value", status: "suggested" },
              ],
            },
            warnings: [],
          },
        }),
      },
    ],
    {
      role: "guided_interpretation",
      jsonMode: true,
      maxCompletionTokens: 2_000,
      reasoningEffort: "none",
      taskName: "guided commercial change interpretation",
    },
  );
  const rawOutput = modelCall.data;
  const parsed = parseCompleteJsonObject(rawOutput);
  const response = parseAiGuidedResponse(parsed);
  if (response.context.scope !== input.scope)
    throw new Error("Guided response changed the active scope.");
  for (const change of response.proposedChanges ?? []) {
    if (!change.fieldPath || !isAllowedPath(input.scope, change.fieldPath))
      throw new Error(`Unsupported guided field path: ${change.fieldPath ?? "missing"}.`);
  }
  return { response, rawOutput, modelCall };
}

function isAllowedPath(scope: "company" | "campaign", path: string) {
  return (allowedFields[scope] ?? []).some((allowed) => {
    if (!allowed.includes("<offeringId>")) return allowed === path;
    const pattern = new RegExp(`^${allowed.replace("<offeringId>", "[^.]+")}$`);
    return pattern.test(path);
  });
}

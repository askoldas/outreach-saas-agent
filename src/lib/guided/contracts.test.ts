import assert from "node:assert/strict";
import test from "node:test";
import { parseAiGuidedResponse } from "./contracts.ts";

test("validates a guided response with a confirmable structured proposal", () => {
  const result = parseAiGuidedResponse({
    message: "I interpreted your target market.",
    context: { scope: "campaign", campaignId: "campaign-1" },
    question: {
      id: "company_size",
      title: "Which threshold should larger mean?",
      inputType: "single_select",
      options: [{ id: "500", label: "More than 500", recommended: true }],
      allowOther: true,
      allowFreeTextExplanation: true,
      required: true,
    },
    proposedChanges: [
      {
        id: "set-market",
        operation: "set",
        entityType: "campaign",
        entityId: "campaign-1",
        fieldPath: "geography",
        proposedValue: "Europe",
        confidence: "high",
        requiresConfirmation: true,
      },
    ],
  });
  assert.equal(result.context.scope, "campaign");
  assert.equal(result.proposedChanges?.[0]?.fieldPath, "geography");
});

test("rejects arbitrary operations and non-create changes without field paths", () => {
  const base = {
    message: "Proposal",
    context: { scope: "company" },
    proposedChanges: [
      {
        id: "unsafe",
        operation: "delete",
        entityType: "company_profile",
        proposedValue: true,
        requiresConfirmation: true,
      },
    ],
  };
  assert.throws(() => parseAiGuidedResponse(base), /Invalid operation/);
  base.proposedChanges[0]!.operation = "set";
  assert.throws(() => parseAiGuidedResponse(base), /requires fieldPath/);
});

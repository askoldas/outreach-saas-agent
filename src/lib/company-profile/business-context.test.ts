import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyStructuredProfile,
  parseStructuredCompanyProfile,
} from "./structured-profile.ts";

test("B2C audiences remain profile facts while proposed B2B applications require confirmation", () => {
  const profile = createEmptyStructuredProfile({
    name: "Device Repair",
    websiteUrl: "https://repair.example",
  });
  profile.capabilities = [
    {
      id: "device_repair",
      name: "Multi-device repair",
      relatedOfferingIds: [],
      confidence: "high",
      status: "confirmed",
    },
  ];
  profile.businessContext = {
    businessModel: "b2c",
    currentCustomerGroups: [
      {
        id: "consumer_customers",
        name: "Individual consumers",
        kind: "consumer",
        evidence: ["Website addresses private device owners."],
        confidence: "high",
      },
    ],
    potentialB2BApplications: [
      {
        id: "business_device_service",
        name: "Business device repair",
        description: "Repair service packaged for organizations with multiple devices.",
        supportedByCapabilityIds: ["device_repair"],
        confidence: "medium",
        requiresConfirmation: true,
      },
    ],
    unresolvedQuestions: [],
  };

  const parsed = parseStructuredCompanyProfile(profile);
  assert.equal(parsed.businessContext?.currentCustomerGroups[0]?.kind, "consumer");
  assert.equal(
    parsed.businessContext?.potentialB2BApplications[0]?.requiresConfirmation,
    true,
  );
});

test("profile analysis exposes at most three high-impact questions in priority order", () => {
  const profile = createEmptyStructuredProfile({
    name: "Broad Manufacturer",
    websiteUrl: "https://manufacturer.example",
  });
  profile.businessContext = {
    businessModel: "unclear",
    currentCustomerGroups: [],
    potentialB2BApplications: [],
    unresolvedQuestions: [1, 5, 3, 2].map((priority) => ({
      id: `question_${priority}`,
      question: `High-impact question ${priority}?`,
      reason: "The answer changes the commercial offering.",
      impact: "offering_definition",
      answerType: "single_select",
      required: false,
      skippable: true,
      priority,
    })),
  };

  const parsed = parseStructuredCompanyProfile(profile);
  assert.deepEqual(
    parsed.businessContext?.unresolvedQuestions.map((question) => question.priority),
    [5, 3, 2],
  );
});

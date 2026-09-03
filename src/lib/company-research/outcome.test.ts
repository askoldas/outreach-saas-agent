import assert from "node:assert/strict";
import test from "node:test";
import {
  completeCompanyResearchOutcome,
  countDeliveredCompanies,
  isDeliveredQualificationLane,
} from "./outcome.ts";

test("only resolved recommended and conditional companies count as delivered", () => {
  assert.equal(isDeliveredQualificationLane("recommended"), true);
  assert.equal(isDeliveredQualificationLane("conditional"), true);
  assert.equal(isDeliveredQualificationLane("requires_research"), false);
  assert.equal(
    countDeliveredCompanies([
      { companyId: "company-1", lane: "recommended" },
      { companyId: "company-1", lane: "conditional" },
      { companyId: "company-2", lane: "rejected" },
      { companyId: null, lane: "recommended" },
      { companyId: "company-3", lane: "conditional" },
    ]),
    2,
  );
});

test("target reached requires the full requested outcome", () => {
  assert.throws(
    () =>
      completeCompanyResearchOutcome({
        requestedCompanyCount: 25,
        deliveredCompanyCount: 17,
        reason: "target_reached",
      }),
    /Target reached requires/,
  );
  assert.equal(
    completeCompanyResearchOutcome({
      requestedCompanyCount: 25,
      deliveredCompanyCount: 25,
      reason: "target_reached",
    }).state,
    "target_reached",
  );
});

test("market exhaustion and internal guards preserve a successful partial outcome", () => {
  for (const reason of ["market_exhausted", "internal_cost_guard"] as const) {
    const outcome = completeCompanyResearchOutcome({
      requestedCompanyCount: 25,
      deliveredCompanyCount: 17,
      reason,
    });
    assert.equal(outcome.state, "partial_complete");
    assert.equal(outcome.deliveredCompanyCount, 17);
  }
});

test("only a genuine technical failure maps to failed", () => {
  assert.equal(
    completeCompanyResearchOutcome({
      requestedCompanyCount: 25,
      deliveredCompanyCount: 0,
      reason: "technical_failure",
    }).state,
    "failed",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { companyResearchOutcomeCopy } from "./outcome-copy.ts";

test("partial market outcomes explain that standards were preserved", () => {
  const copy = companyResearchOutcomeCopy({
    completionReason: "market_exhausted",
    deliveredCompanyCount: 17,
    requestedCompanyCount: 25,
  });
  assert.match(copy.description, /17 \/ 25/);
  assert.match(copy.description, /did not weaken qualification standards/i);
  assert.match(copy.suggestion ?? "", /broaden the target|expand the geography/i);
});

test("internal guards and provider failures use product-facing language", () => {
  const guard = companyResearchOutcomeCopy({
    completionReason: "internal_cost_guard",
    deliveredCompanyCount: 18,
    requestedCompanyCount: 25,
  });
  const provider = companyResearchOutcomeCopy({
    completionReason: "provider_failure",
    deliveredCompanyCount: 12,
    requestedCompanyCount: 25,
  });
  assert.doesNotMatch(`${guard.title} ${guard.description}`, /credit|budget/i);
  assert.doesNotMatch(`${provider.title} ${provider.description}`, /tavily|openrouter/i);
});

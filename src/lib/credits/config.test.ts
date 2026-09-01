import assert from "node:assert/strict";
import test from "node:test";
import { costUsdToCredits, getCreditEconomics } from "./config.ts";

test("credit conversion is centralized and supports fractional credits", () => {
  assert.equal(
    costUsdToCredits(0.015, { OPPTIUM_COST_PER_CREDIT_USD: "0.02" }),
    0.75,
  );
});

test("research authorization has one configurable default", () => {
  assert.equal(
    getCreditEconomics({ OPPTIUM_DEFAULT_RESEARCH_CREDIT_CAP: "42.5" })
      .defaultResearchCreditCap,
    42.5,
  );
});

test("Tavily provider economics remain separate from product credits", () => {
  const economics = getCreditEconomics({
    OPPTIUM_COST_PER_CREDIT_USD: "0.02",
    TAVILY_PROVIDER_CREDIT_COST_USD: "0.01",
  });
  assert.equal(economics.tavilyProviderCreditCostUsd, 0.01);
  assert.equal(costUsdToCredits(economics.tavilyProviderCreditCostUsd), 1);
});

test("invalid commercial configuration fails closed", () => {
  assert.throws(
    () => getCreditEconomics({ OPPTIUM_COST_PER_CREDIT_USD: "0" }),
    /must be a positive number/,
  );
});

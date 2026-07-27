import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicRefinementPlan } from "./iteration-refinement.ts";

test("deterministic refinement changes source family without exceeding query limits", () => {
  const plan = buildDeterministicRefinementPlan({
    iteration: 3,
    previousQueries: Array.from(
      { length: 15 },
      (_, index) => `German software agency ${index}`,
    ),
  });
  assert.equal(plan.queries.length, 10);
  assert.ok(plan.queries.every((query) => query.includes("trade association members")));
  assert.equal(plan.resultsPerQuery, 8);
});

test("deterministic refinement rejects unbounded iterations and empty queries", () => {
  assert.throws(
    () => buildDeterministicRefinementPlan({ iteration: 6, previousQueries: ["x"] }),
    /between 2 and 5/,
  );
  assert.throws(
    () => buildDeterministicRefinementPlan({ iteration: 2, previousQueries: [] }),
    /requires prior queries/,
  );
});

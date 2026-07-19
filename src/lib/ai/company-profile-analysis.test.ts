import assert from "node:assert/strict";
import test from "node:test";
import { parseCompanyProfileAnalysis } from "./company-profile-analysis.ts";

test("parses schema-validated Company Profile analysis", () => {
  const result = parseCompanyProfileAnalysis(
    JSON.stringify({
      companyName: "Example Industries",
      website: "https://example.test",
      summary: "Industrial services company",
      productsAndServices: ["Maintenance"],
      capabilities: [],
      customerTypes: ["Manufacturers"],
      differentiators: [],
      proofPoints: [],
      marketsAndLanguages: ["English"],
      claims: [],
      limitations: [],
      sources: ["https://example.test"],
      warnings: [],
    }),
  );
  assert.equal(result.companyName, "Example Industries");
  assert.deepEqual(result.productsAndServices, ["Maintenance"]);
});

test("rejects incomplete Company Profile analysis", () => {
  assert.throws(
    () => parseCompanyProfileAnalysis('{"companyName":"Example"}'),
    /invalid website/,
  );
});

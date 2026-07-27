import assert from "node:assert/strict";
import test from "node:test";
import { classifySearchResults } from "./result-classifier.ts";

test("directory pages are source leads, not prospect-company identities", () => {
  const result = classifySearchResults([
    {
      content: "A directory of European manufacturers",
      query: "manufacturers Latvia directory",
      score: 0.9,
      title: "Manufacturers directory",
      url: "https://www.europages.com/companies/manufacturers.html",
    },
  ]);
  assert.equal(result.acceptedResults.length, 0);
  assert.equal(result.rejectedResults.length, 1);
});

test("genuine company websites remain eligible for inspection", () => {
  const result = classifySearchResults([
    {
      content: "We manufacture industrial control systems for B2B customers.",
      query: "control systems Latvia company",
      score: 0.8,
      title: "Example Controls",
      url: "https://example-controls.lv/about",
    },
  ]);
  assert.equal(result.acceptedResults.length, 1);
  assert.ok(
    ["company_website", "company_contact_page"].includes(
      result.acceptedResults[0]?.classification.sourceType ?? "",
    ),
  );
});

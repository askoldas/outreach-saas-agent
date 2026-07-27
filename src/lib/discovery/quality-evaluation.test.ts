import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractDirectoryEntityCandidates } from "./directory-entity-extractor.ts";
import { evaluateBinaryDecisions } from "./quality-evaluation.ts";
import { classifySearchResults } from "./result-classifier.ts";

type Fixture = {
  minimumPrecision: number;
  minimumRecall: number;
  cases: Array<{
    content: string;
    expectedEligible: boolean;
    id: string;
    query: string;
    title: string;
    url: string;
  }>;
  directoryCases: Array<{
    content: string;
    expectedDomains: string[];
    id: string;
    query: string;
    sourceUrl: string;
  }>;
};

const fixturePath = fileURLToPath(
  new URL("../../../tests/fixtures/discovery/classification-cases.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

test("discovery classification meets labeled precision and recall floors", () => {
  const metrics = evaluateBinaryDecisions(
    fixture.cases.map((item) => ({
      actual:
        classifySearchResults([{ ...item, score: 0.8 }]).acceptedResults.length === 1,
      expected: item.expectedEligible,
    })),
  );
  assert.ok(metrics.precision >= fixture.minimumPrecision);
  assert.ok(metrics.recall >= fixture.minimumRecall);
});

test("directory fixtures extract only labeled company domains", () => {
  for (const item of fixture.directoryCases) {
    const candidates = extractDirectoryEntityCandidates(
      {
        content: "",
        query: item.query,
        score: 0.8,
        title: item.id,
        url: item.sourceUrl,
      },
      item.content,
    );
    assert.deepEqual(
      candidates.map((candidate) => new URL(candidate.url).hostname),
      item.expectedDomains,
      item.id,
    );
  }
});

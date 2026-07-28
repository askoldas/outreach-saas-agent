import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCandidatesWithAi,
  parseCandidateClassificationBatch,
} from "./candidate-classification.ts";

test("candidate classification accepts promising and policy-selected possible results", () => {
  const result = parseCandidateClassificationBatch(
    {
      classifications: [
        {
          candidateKey: "a",
          status: "promising",
          confidence: 0.9,
          geographyMatch: true,
          reasons: ["Target company category"],
          shouldEvaluate: true,
        },
        {
          candidateKey: "b",
          status: "possible",
          confidence: 0.7,
          geographyMatch: null,
          reasons: ["Category is plausible but geography is unknown"],
          shouldEvaluate: true,
        },
      ],
    },
    new Set(["a", "b"]),
  );
  assert.equal(result[0]?.shouldEvaluate, true);
  assert.equal(result[1]?.shouldEvaluate, true);
});

test("low-confidence possible and excluded candidates cannot request evaluation", () => {
  const result = parseCandidateClassificationBatch(
    {
      classifications: [
        {
          candidateKey: "a",
          status: "possible",
          confidence: 0.4,
          geographyMatch: null,
          reasons: ["Very little evidence"],
          shouldEvaluate: true,
        },
        {
          candidateKey: "b",
          status: "excluded",
          confidence: 0.95,
          geographyMatch: false,
          exclusionReason: "Outside target geography",
          reasons: ["Located elsewhere"],
          shouldEvaluate: true,
        },
      ],
    },
    new Set(["a", "b"]),
  );
  assert.equal(result[0]?.shouldEvaluate, false);
  assert.equal(result[1]?.shouldEvaluate, false);
});

test("candidate classification retains omitted candidates as insufficient data", () => {
  const result = parseCandidateClassificationBatch(
    { classifications: [] },
    new Set(["required"]),
  );
  assert.deepEqual(result, [
    {
      candidateKey: "required",
      status: "insufficient_data",
      confidence: 0,
      geographyMatch: null,
      reasons: [
        "The classification provider omitted this candidate; it was retained as insufficient data.",
      ],
      shouldEvaluate: false,
    },
  ]);
});

test("candidate classification still rejects invalid and duplicate results", () => {
  assert.throws(
    () =>
      parseCandidateClassificationBatch(
        {
          classifications: [
            {
              candidateKey: "x",
              status: "invented",
              confidence: 0.9,
              reasons: [],
            },
          ],
        },
        new Set(["x"]),
      ),
    /invalid status/,
  );
  assert.throws(
    () =>
      parseCandidateClassificationBatch(
        {
          classifications: [
            {
              candidateKey: "a",
              status: "possible",
              confidence: 0.7,
              geographyMatch: null,
              reasons: [],
              shouldEvaluate: true,
            },
            {
              candidateKey: "a",
              status: "possible",
              confidence: 0.7,
              geographyMatch: null,
              reasons: [],
              shouldEvaluate: true,
            },
          ],
        },
        new Set(["a", "b"]),
      ),
    /unknown or duplicate key/,
  );
});

test("candidate classification preserves valid rows and fills only missing keys", () => {
  const result = parseCandidateClassificationBatch(
    {
      classifications: [
        {
          candidateKey: "b",
          status: "promising",
          confidence: 0.9,
          geographyMatch: true,
          reasons: ["Visible match"],
          shouldEvaluate: true,
        },
      ],
    },
    new Set(["a", "b", "c"]),
  );
  assert.deepEqual(
    result.map(({ candidateKey, status, shouldEvaluate }) => ({
      candidateKey,
      status,
      shouldEvaluate,
    })),
    [
      { candidateKey: "b", status: "promising", shouldEvaluate: true },
      { candidateKey: "a", status: "insufficient_data", shouldEvaluate: false },
      { candidateKey: "c", status: "insufficient_data", shouldEvaluate: false },
    ],
  );
});

test("AI classification exchanges short aliases and restores opaque candidate keys", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-key";
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({
        model: "openai/gpt-5-mini",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    candidateKey: "candidate_001",
                    status: "promising",
                    confidence: 0.9,
                    geographyMatch: true,
                    reasons: ["Matches the target"],
                    shouldEvaluate: true,
                  },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const opaqueKey = "a".repeat(64);
    const result = await classifyCandidatesWithAi({
      campaign: {
        geography: "DE",
        companyTypes: ["Agency"],
        industries: ["Software"],
        characteristics: [],
        exclusions: [],
      },
      candidates: [
        {
          candidateKey: opaqueKey,
          title: "Example GmbH",
          url: "https://example.com",
          snippet: "A software agency.",
          deterministicSourceType: "company_website",
        },
      ],
    });

    assert.match(requestBody, /candidate_001/);
    assert.doesNotMatch(requestBody, new RegExp(opaqueKey));
    assert.equal(result.classifications[0]?.candidateKey, opaqueKey);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

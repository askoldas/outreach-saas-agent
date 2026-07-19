import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateCredits,
  fitLabel,
  leadReviewState,
  recommendContact,
  reviewState,
} from "./domain.ts";

test("maps fit scores to honest descriptive bands", () => {
  assert.equal(fitLabel(91), "Strong fit");
  assert.equal(fitLabel(70), "Good fit");
  assert.equal(fitLabel(50), "Possible fit");
  assert.equal(fitLabel(20), "Weak fit");
});

test("maps persisted lead statuses into campaign review tabs", () => {
  assert.equal(reviewState("needs_review"), "ready");
  assert.equal(reviewState("approved"), "approved");
  assert.equal(reviewState("rejected"), "rejected");
});

test("maps failed qualification and archived records to issues and excluded", () => {
  assert.equal(
    leadReviewState({ qualificationStatus: "failed", status: "needs_review" }),
    "issues",
  );
  assert.equal(
    leadReviewState({ qualificationStatus: "failed", status: "approved" }),
    "approved",
  );
  assert.equal(
    leadReviewState({ qualificationStatus: "qualified", status: "archived" }),
    "excluded",
  );
});

test("recommends a relevant named route ahead of a general inbox", () => {
  const selected = recommendContact([
    {
      type: "email",
      value: "hello@example.com",
      suggestedRole: "General",
      verification: "source_confirmed",
      source: "site",
    },
    {
      type: "person",
      value: "alex@example.com",
      suggestedRole: "Purchasing manager",
      verification: "source_confirmed",
      source: "team page",
    },
  ]);
  assert.equal(selected?.value, "alex@example.com");
});

test("calculates batch estimates deterministically", () => {
  assert.equal(estimateCredits("enrichment", 8), 24);
  assert.equal(estimateCredits("draft", 24), 48);
});

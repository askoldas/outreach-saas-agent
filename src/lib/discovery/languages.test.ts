import assert from "node:assert/strict";
import test from "node:test";
import { deriveDiscoveryLanguages } from "./languages.ts";

test("discovery languages come from target countries with an English fallback", () => {
  assert.deepEqual(deriveDiscoveryLanguages({ countryCodes: ["LT"] }), [
    "Lithuanian",
    "English",
  ]);
  assert.deepEqual(deriveDiscoveryLanguages({ countryCodes: ["EE", "LV", "LT"] }), [
    "Estonian",
    "Latvian",
    "Lithuanian",
    "English",
  ]);
});

test("discovery language derivation does not accept an outreach language", () => {
  assert.deepEqual(deriveDiscoveryLanguages({ countryCodes: ["DE", "AT"] }), [
    "German",
    "English",
  ]);
});

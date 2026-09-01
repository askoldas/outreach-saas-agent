import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { companyProfileRequestTimeoutMs } from "./timeout.ts";

test("Company Intelligence receives a worker-safe extended request timeout", () => {
  assert.equal(companyProfileRequestTimeoutMs({}), 240_000);
  assert.equal(
    companyProfileRequestTimeoutMs({
      OPENROUTER_PROFILE_REQUEST_TIMEOUT_MS: "300000",
    }),
    300_000,
  );
  assert.throws(
    () =>
      companyProfileRequestTimeoutMs({
        OPENROUTER_PROFILE_REQUEST_TIMEOUT_MS: "10000",
      }),
    /between 30000 and 600000/,
  );
});

test("every Company Intelligence model stage passes its dedicated timeout", () => {
  const source = readFileSync(
    "src/server/company-profile-v3/stage-service.ts",
    "utf8",
  );
  assert.match(source, /timeoutMs: companyProfileRequestTimeoutMs\(\)/);
});

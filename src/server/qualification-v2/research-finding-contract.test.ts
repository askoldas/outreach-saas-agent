import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repository = readFileSync(
  join(process.cwd(), "src/server/qualification-v2/repository.ts"),
  "utf8",
);

test("Qualification accepts Candidate Research finding keys alongside persisted claim IDs", () => {
  const findingSchema = repository.slice(
    repository.indexOf("const questionFindingSchema"),
    repository.indexOf("const factorSchema"),
  );
  assert.match(
    findingSchema,
    /claimKeys: z\.array\(z\.string\(\)\.min\(1\)\)\.optional\(\)/,
  );
  assert.match(
    findingSchema,
    /claimIds: z\.array\(z\.string\(\)\.min\(1\)\)/,
  );
  assert.match(findingSchema, /\.strict\(\)/);
});

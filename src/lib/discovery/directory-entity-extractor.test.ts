import assert from "node:assert/strict";
import test from "node:test";
import { extractDirectoryEntityCandidates } from "./directory-entity-extractor.ts";

test("extracts bounded first-party company websites from directory evidence", () => {
  const candidates = extractDirectoryEntityCandidates(
    {
      content: "European manufacturers",
      query: "industrial manufacturers Latvia directory",
      score: 0.8,
      title: "Manufacturer directory",
      url: "https://www.europages.com/companies/manufacturers.html",
    },
    [
      "Alpha: https://www.alpha-controls.lv/about",
      "Duplicate: https://alpha-controls.lv/contact",
      "Beta: https://beta-factory.eu",
      "Social: https://www.linkedin.com/company/beta",
      "Directory: https://www.europages.com/company/alpha",
    ].join("\n"),
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.url),
    ["https://www.alpha-controls.lv", "https://beta-factory.eu"],
  );
  assert.equal(
    candidates[0]?.directorySourceUrl,
    "https://www.europages.com/companies/manufacturers.html",
  );
});

test("respects the per-source extraction ceiling", () => {
  const candidates = extractDirectoryEntityCandidates(
    {
      content: "",
      query: "directory",
      score: null,
      title: "Directory",
      url: "https://directory.example/list",
    },
    "https://one.example https://two.example https://three.example",
    2,
  );
  assert.equal(candidates.length, 2);
});

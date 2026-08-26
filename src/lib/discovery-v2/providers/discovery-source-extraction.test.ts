import assert from "node:assert/strict";
import test from "node:test";
import { extractOrganizationsFromDiscoverySource } from "./discovery-source-extraction.ts";

test("directory extraction is bounded, domain-normalized, deduplicated, and provenance retaining", () => {
  const page = extractOrganizationsFromDiscoverySource({
    sourceUrl: "https://association.example/members",
    content: [
      "[Acme Industries](https://www.acme.example/about)",
      "[Acme duplicate](https://acme.example/products)",
      '<a href="https://beta.example/contact">Beta Manufacturing</a>',
      "[Association home](https://association.example/)",
      "[LinkedIn](https://linkedin.com/company/acme)",
    ].join("\n"),
    maximumOrganizations: 2,
  });
  assert.deepEqual(
    page.organizations.map(({ name, canonicalDomainHint }) => ({
      name,
      canonicalDomainHint,
    })),
    [
      { name: "Acme Industries", canonicalDomainHint: "acme.example" },
      { name: "Beta Manufacturing", canonicalDomainHint: "beta.example" },
    ],
  );
  assert.ok(
    page.organizations.every(
      ({ discoverySourceUrl }) =>
        discoverySourceUrl === "https://association.example/members",
    ),
  );
  assert.equal(page.exhausted, true);
  assert.equal(page.nextOffset, null);
});

test("source extraction continues in stable chunks without duplicating references", () => {
  const content = ["- Alpha Manufacturing", "- Beta Logistics", "- Gamma Software"].join(
    "\n",
  );
  const first = extractOrganizationsFromDiscoverySource({
    sourceUrl: "https://event.example/exhibitors",
    content,
    maximumOrganizations: 2,
  });
  const second = extractOrganizationsFromDiscoverySource({
    sourceUrl: "https://event.example/exhibitors",
    content,
    offset: first.nextOffset ?? 0,
    maximumOrganizations: 2,
  });
  assert.deepEqual(
    first.organizations.map(({ name }) => name),
    ["Alpha Manufacturing", "Beta Logistics"],
  );
  assert.deepEqual(
    second.organizations.map(({ name }) => name),
    ["Gamma Software"],
  );
  assert.equal(first.exhausted, false);
  assert.equal(second.exhausted, true);
  assert.equal(
    new Set(
      [...first.organizations, ...second.organizations].map(
        ({ referenceKey }) => referenceKey,
      ),
    ).size,
    3,
  );
});

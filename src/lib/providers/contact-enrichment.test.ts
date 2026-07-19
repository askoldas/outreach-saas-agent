import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContactEnrichmentQuery,
  enrichCompanyContacts,
} from "./contact-enrichment.ts";

test("builds a company-domain-scoped contact query", () => {
  assert.equal(
    buildContactEnrichmentQuery({
      company: "Acme Ltd",
      website: "https://www.acme.test",
    }),
    'site:acme.test "Acme Ltd" contact email phone',
  );
});

test("maps provider evidence to routes with verification provenance", async () => {
  const routes = await enrichCompanyContacts(
    { company: "Acme Ltd", website: "https://acme.test" },
    async () => [
      {
        content: "Sales: hello@acme.test",
        score: 0.9,
        title: "Contact Acme",
        url: "https://acme.test/contact",
      },
    ],
  );

  const email = routes.find((route) => route.type === "Email");
  assert.equal(email?.value, "hello@acme.test");
  assert.equal(email?.verification, "source_confirmed");
  assert.equal(email?.provenance.provider, "tavily");
  assert.equal(email?.provenance.sourceUrl, "https://acme.test/contact");
  assert.match(email?.provenance.query ?? "", /site:acme\.test/);
});

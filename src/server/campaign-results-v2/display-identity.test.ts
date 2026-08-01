import assert from "node:assert/strict";
import test from "node:test";
import { resolveCandidateDisplayIdentity } from "./display-identity.ts";

test("legacy content-title records recover the host company and root website", () => {
  assert.deepEqual(
    resolveCandidateDisplayIdentity({
      canonicalDomainHint: "camberpharma.com",
      organizationDomain: null,
      organizationName: "Vertical Integration",
      organizationWebsiteUrl: null,
      sourceTitle: "Vertical Integration – Camber Pharmaceuticals",
      sourceUrl: "https://www.camberpharma.com/vertical-integration",
    }),
    {
      domain: "camberpharma.com",
      name: "Camber Pharmaceuticals",
      sourceUrl: "https://www.camberpharma.com/vertical-integration",
      websiteUrl: "https://camberpharma.com/",
    },
  );
});

test("a domain-derived company name replaces an unrelated page heading", () => {
  assert.equal(
    resolveCandidateDisplayIdentity({
      canonicalDomainHint: "freudenbergmedical.com",
      organizationDomain: null,
      organizationName: "Vertical Integration for Medical Device Manufacturing",
      organizationWebsiteUrl: null,
      sourceTitle: "Vertical Integration for Medical Device Manufacturing",
      sourceUrl: "https://freudenbergmedical.com/innovate-deliver/vertical-integration",
    }).name,
    "Freudenberg Medical",
  );
});

test("canonical organization identity remains authoritative", () => {
  assert.deepEqual(
    resolveCandidateDisplayIdentity({
      canonicalDomainHint: "publisher.example",
      organizationDomain: "acme.example",
      organizationName: "Acme Pharma",
      organizationWebsiteUrl: "https://www.acme.example/about",
      sourceTitle: "Unrelated article title",
      sourceUrl: "https://publisher.example/article",
    }),
    {
      domain: "acme.example",
      name: "Acme Pharma",
      sourceUrl: "https://publisher.example/article",
      websiteUrl: "https://www.acme.example/about",
    },
  );
});

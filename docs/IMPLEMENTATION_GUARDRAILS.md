# Implementation Guardrails

This file is a compact checklist for feature work. Detailed rules live in the linked documents.

## Always preserve

- Horizontal product behavior: medical is only a test scenario.
- Workspace-based tenant isolation.
- Human approval before any external outreach.
- Separation of facts, inferences, unknowns, and conflicts.
- Source provenance for prospect claims.
- Durable background execution for long-running research.
- Provider-neutral interfaces.
- Versioned offer, strategy, prompt, and qualification inputs.
- Explicit workflow state and audit history.

## Never introduce silently

- Automatic email sending.
- Logged-in LinkedIn scraping or access-control bypass.
- Medical-only fields in shared models.
- Provider SDK types in domain entities.
- Model output used as authorization or billing logic.
- Cross-tenant data reuse.
- Unversioned prompt strings scattered through route code.
- Long research loops inside web request handlers.
- Secrets in client bundles, logs, fixtures, or source control.
- Claims of successful checks that were not run.

## Required review triggers

Update `docs/DECISIONS.md` before or with a change that selects or replaces:

- package or monorepo orchestration tooling;
- durable-job platform;
- primary search provider;
- primary model provider;
- cross-tenant public-data reuse;
- integrated email sending;
- authentication or database platform;
- deployment architecture.

## Key references

- Product boundaries: [`PRODUCT.md`](PRODUCT.md)
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Domain invariants: [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md)
- AI rules: [`AI_PIPELINE.md`](AI_PIPELINE.md)
- Security: [`SECURITY_AND_COMPLIANCE.md`](SECURITY_AND_COMPLIANCE.md)
- Testing: [`TESTING.md`](TESTING.md)

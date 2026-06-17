# AGENTS.md

This file defines repository-wide instructions for Codex and other coding agents.

## 1. Mission

Build a horizontal, multi-tenant SaaS that helps businesses turn their products or services into researched B2B prospecting campaigns.

The system must:

1. understand a seller's offer;
2. help define an ideal customer and campaign;
3. choose suitable public research sources;
4. discover and deduplicate candidate companies;
5. research and qualify candidates using evidence;
6. find public contact routes;
7. prepare grounded outreach drafts;
8. require human review before sending.

Medical sales is the first validation scenario only. Never encode medical-specific assumptions into shared domain models, database tables, services, prompts, or UI components.

## 2. Read before changing code

For every task, read the relevant parts of:

- `README.md`
- `docs/PRODUCT.md`
- `docs/REPOSITORY_STRUCTURE.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/AI_PIPELINE.md`
- `docs/SECURITY_AND_COMPLIANCE.md`
- `docs/TESTING.md`
- `docs/DECISIONS.md`

Treat accepted decisions in `docs/DECISIONS.md` as binding. When implementation and documentation disagree, do not silently choose one. Preserve working behavior, explain the conflict, and update the relevant decision or documentation in the same change.

## 3. Current phase

The repository is currently in foundation design. Do not build unrelated product features before the foundation milestone in `docs/ROADMAP.md` is complete.

When no application scaffold or command exists yet, do not invent commands in documentation or claim that checks were run.

## 4. Working method

For each task:

1. inspect the repository and identify the smallest relevant surface;
2. state assumptions in the task summary when requirements are incomplete;
3. implement the smallest coherent change;
4. add or update tests for behavior changes;
5. run the narrowest relevant checks, then broader checks when available;
6. update documentation when contracts, behavior, setup, or decisions change;
7. report changed files, checks run, and unresolved risks.

Avoid broad refactors during feature work unless the refactor is required for correctness. Do not reformat unrelated files.

## 5. Architecture rules

- Use TypeScript with strict type checking.
- Keep the web application, domain logic, provider adapters, persistence, and long-running workers separated.
- Domain code must not import framework-specific UI or route modules.
- Provider SDKs must remain behind internal interfaces.
- Long-running research must not execute inside a normal HTTP request lifecycle.
- Background jobs must be retry-safe and idempotent.
- Persist workflow state explicitly; do not depend on model conversation memory.
- Prefer deterministic code for validation, scoring boundaries, status transitions, permissions, deduplication, and billing.
- Use AI for interpretation and generation only where deterministic code is insufficient.
- Do not introduce n8n as the core runtime. It may be added later as an optional integration adapter.
- Do not couple the domain model to one search, scraping, enrichment, email, queue, database, or model provider.

## 6. Product boundaries

### Required boundaries

- `Workspace` owns tenant data.
- `Offer` describes what the customer sells.
- `Campaign` describes a market-search objective for one offer.
- `Lead` is a candidate company inside a campaign.
- `Source` stores evidence used for claims.
- `Qualification` stores scored conclusions and reasoning.
- `Contact` stores a public business contact route or person.
- `OutreachDraft` is generated content and is never equivalent to a sent message.
- `Activity` records important state changes and user actions.

### MVP restrictions

- No automatic bulk sending.
- No autonomous follow-up sending.
- No LinkedIn login automation or direct scraping behind authentication.
- No claim that a contact is verified unless the verification method is recorded.
- No factual prospect claim without a source or an explicit `inferred` label.
- No generic hidden global memory containing tenant business data.

## 7. Multi-tenancy and authorization

- Every tenant-owned record must be traceable to a workspace.
- Enforce authorization server-side, not only in UI code.
- Database row-level security is required where supported.
- Never accept a client-provided `workspaceId` as sufficient authorization.
- Service-role database access must be isolated to trusted server or worker code.
- Tests must cover cross-workspace access denial for sensitive operations.

## 8. Database changes

- All schema changes require an ordered migration.
- Never edit an already-applied migration to change behavior; create a new migration.
- Include constraints, indexes, and tenant ownership deliberately.
- Use database enums sparingly; prefer constrained text when product states are likely to evolve.
- Store timestamps in UTC.
- Store normalized URLs and normalized domains for deduplication.
- Keep raw provider payloads separate from normalized domain records when retained.
- Document retention-sensitive fields.

## 9. AI and prompt rules

- Prompts are versioned product assets, not inline strings scattered across routes.
- Every structured AI response must be validated against a schema.
- A model failure must not corrupt workflow state.
- Store model/provider, prompt version, execution status, and relevant usage metadata for auditable runs.
- Never use model output directly for authorization, billing, irreversible deletion, or sending.
- Separate facts, inferences, and recommendations in schemas and UI.
- Do not fabricate sources, URLs, contacts, statistics, company details, or personalization.
- Outreach drafts may only use approved seller claims and supported prospect evidence.
- Keep temperature and model-specific settings in provider configuration, not business logic.

## 10. Research and source rules

- Respect robots directives, source terms, rate limits, privacy constraints, and applicable law.
- Prefer public company websites, registries, directories, associations, procurement portals, event lists, and other lawful public sources.
- Record source URL, retrieval time, source type, and extraction status.
- Keep source text excerpts short and relevant.
- Deduplicate by normalized domain and other stable identifiers when available.
- Re-running discovery must not create duplicate leads for the same campaign.
- Source failure must degrade gracefully and remain visible in run diagnostics.

## 11. Outreach safety

- The MVP prepares drafts; the user approves and sends externally.
- A compose-in-email-client action is allowed, but it must not falsely mark a message as sent.
- Sending integrations added later require explicit user action, audit records, suppression handling, and compliance review.
- Respect opt-outs and suppression lists.
- Do not generate deceptive identities, fake familiarity, or unsupported personalization.

## 12. UI rules

- The dashboard is the primary interface; chat is optional, not the core navigation model.
- Important workflow state must be visible through pages, tables, filters, and activity history.
- Show why a lead was selected and which evidence supports it.
- Make low confidence, missing data, conflicts, and AI inferences visible.
- Destructive or irreversible actions require confirmation.
- Keep accessibility and keyboard interaction in scope from the first implementation.

## 13. Testing expectations

Follow `docs/TESTING.md`.

At minimum, new behavior should include the appropriate combination of:

- unit tests for deterministic domain logic;
- contract tests for provider adapters;
- integration tests for database and authorization behavior;
- workflow tests for retries and idempotency;
- end-to-end tests for critical user journeys.

Do not replace meaningful assertions with snapshots. Mock external providers at boundaries, not internal domain behavior.

## 14. Environment and secrets

- Never commit secrets, personal API keys, production credentials, or real customer data.
- Maintain `.env.example` when environment variables are introduced.
- Validate required environment variables at startup.
- Use clearly fake test fixtures.
- Logs must not expose full email bodies, secret keys, authentication tokens, or unnecessary personal data.

## 15. Documentation rules

Update documentation in the same change when modifying:

- domain terminology;
- architecture boundaries;
- database contracts;
- environment setup;
- commands;
- provider behavior;
- workflow states;
- security or compliance behavior;
- accepted architecture decisions.

Use concise, current documentation. Remove superseded instructions instead of stacking contradictory notes.

## 16. Completion report

At the end of a Codex task, report:

- what changed;
- why it changed;
- tests and checks run, with results;
- migrations or environment changes;
- remaining risks, assumptions, or follow-up work.

Never claim success for a check that was not executed.

# Security and Compliance

## 1. Scope

This document defines engineering requirements and product safeguards. It is not legal advice. Before production outreach or entry into a new market, obtain jurisdiction-specific legal review for privacy, direct marketing, electronic communications, data retention, and industry rules.

## 2. Security principles

- least privilege;
- tenant isolation by default;
- explicit human approval for external actions;
- data minimization;
- traceable evidence and model executions;
- secrets never exposed to browsers or logs;
- untrusted web content isolated from system instructions;
- safe failure over silent continuation;
- reversible user actions where practical;
- defense in depth rather than reliance on one control.

## 3. Data classification

Classify stored data at minimum as:

### Public source data

Information retrieved from publicly accessible business sources, such as company websites, registries, and directories.

Public availability does not remove privacy, licensing, retention, or accuracy responsibilities.

### Workspace confidential data

Seller descriptions, internal notes, campaign strategy, uploaded documents, approved claims, pricing context, and user edits.

Never reuse this data across workspaces without explicit authorization.

### Personal data

Names, professional roles, email addresses, phone numbers, profile URLs, activity history, and account data that relate to an identifiable person.

Collect only what the workflow needs and retain provenance.

### Credentials and secrets

OAuth tokens, API keys, service-role credentials, signing secrets, webhook secrets, and encryption keys.

Store only in approved secret stores or encrypted provider-managed storage. Never store plaintext secrets in normal application tables.

## 4. Authentication and sessions

- Use a maintained authentication provider.
- Require verified email where appropriate for account security.
- Use secure, HTTP-only cookies for browser sessions.
- Protect state-changing requests against cross-site request forgery where the framework does not provide equivalent protection.
- Rotate or revoke sessions after sensitive account changes when supported.
- Add multi-factor authentication later for privileged or sending-enabled accounts.
- Rate-limit authentication and recovery endpoints.

## 5. Authorization and tenant isolation

- Resolve workspace membership server-side for every tenant operation.
- Do not trust hidden fields, route parameters, or client state as authorization.
- Apply database row-level security as defense in depth.
- Restrict service-role clients to server and worker environments.
- Use separate access paths for normal users and trusted background workers.
- Test direct-object-reference attacks across all major entities.
- Audit membership, ownership, export, deletion, integration, and billing changes.

## 6. External providers

Before adding a provider, document:

- purpose;
- data sent;
- data returned;
- retention behavior;
- processing region when relevant;
- authentication method;
- rate limits;
- terms or source restrictions;
- fallback behavior;
- deletion or revocation procedure;
- whether customer content may be used for provider training;
- approved environment variables.

Provider adapters must send only the minimum data required for the task.

## 7. Public-source research

- Access only sources the product is permitted to access.
- Respect access controls, robots directives, rate limits, and applicable source terms.
- Do not bypass authentication, paywalls, CAPTCHAs, or technical restrictions.
- Do not automate logged-in LinkedIn access or scrape private profile data.
- Prefer company-level information and public business contact routes.
- Retain URL, retrieval time, and extraction provenance.
- Support removal or correction of inaccurate data.
- Avoid collecting sensitive personal information unrelated to B2B outreach.

## 8. Prompt injection and untrusted content

All crawled pages, search snippets, uploaded documents, and provider text are untrusted.

Controls:

- delimit source content clearly;
- never interpret source text as system or developer instructions;
- use narrow task-specific model calls;
- do not expose credentials or arbitrary tools to extraction prompts;
- validate structured output;
- allow only workflow-controlled URLs and actions;
- sanitize rendered source excerpts;
- scan uploads and restrict file types when upload is introduced;
- record suspicious instruction patterns as warnings;
- keep authorization and sending decisions outside the model.

## 9. Outreach controls

### MVP

- drafts only;
- explicit user approval;
- copy or open external compose window;
- no automatic sent status;
- no bulk autonomous sequence execution.

### Before integrated sending

Implement and review:

- mailbox OAuth and token protection;
- explicit send authorization;
- sender identity and domain controls;
- suppression lists;
- opt-out recording;
- rate and volume controls;
- audit trail;
- delivery and bounce handling where available;
- user-configurable compliance text;
- jurisdiction and campaign restrictions;
- abuse detection and account suspension workflow.

The system must not be designed to evade spam controls or conceal sender identity.

## 10. Privacy lifecycle

The implementation should support:

- clear purpose for collected data;
- data minimization;
- workspace-visible provenance;
- configurable retention classes;
- correction of inaccurate records;
- deletion or anonymization workflows;
- export of workspace data;
- account and workspace closure;
- provider credential revocation;
- deletion propagation where technically available;
- documented backup retention.

Do not promise immediate physical deletion from backups when the infrastructure does not provide it. Document the actual lifecycle.

## 11. Retention direction

Exact periods require product and legal decisions. The schema should distinguish at least:

- account and membership data;
- active campaign data;
- public-source snapshots;
- personal contact data;
- model execution metadata;
- raw provider responses;
- logs and traces;
- uploaded documents;
- audit events;
- deleted workspace tombstones.

Raw page bodies and provider payloads should generally have shorter retention than normalized evidence unless a clear product need justifies otherwise.

## 12. Logging and observability

Logs must avoid:

- API keys and tokens;
- authorization headers;
- password or recovery data;
- full uploaded documents;
- unrestricted crawled page bodies;
- complete email drafts by default;
- unnecessary personal contact fields.

Use stable identifiers, outcome categories, counts, durations, and redacted summaries.

Access to production logs should be limited and audited through the hosting providers where available.

## 13. Encryption

- Use TLS for all external and internal network communication supported by the platform.
- Use provider-managed encryption at rest at minimum.
- Consider field-level encryption for long-lived OAuth refresh tokens and similarly sensitive credentials.
- Separate encryption and signing secrets by purpose.
- Rotate secrets after exposure and support planned rotation.

## 14. Web application security

- Validate all inputs at trust boundaries.
- Encode or sanitize untrusted output before rendering.
- Use framework-safe query and mutation patterns.
- Apply content security policy when the application structure is stable enough to maintain it.
- Restrict file uploads by type, size, and processing path.
- Protect exports and signed URLs with authorization and expiration.
- Add rate limits to costly or abuse-prone operations.
- Keep dependencies current and enable automated vulnerability alerts.

## 15. Worker security

- Workers receive only required secrets.
- Jobs carry record identifiers, not large unrestricted secrets or source bodies.
- Every job resolves workspace ownership before write operations.
- Idempotency prevents retry-based duplicate effects.
- Cancellation and quota checks occur between bounded steps.
- Provider concurrency is controlled centrally.
- Failed jobs do not leak source contents into user-visible error messages.

## 16. AI safety and accuracy

- Validate all structured model output.
- Store facts and inferences separately.
- Require evidence references for prospect claims.
- Never let model output authorize access, spending, sending, deletion, or role changes.
- Make uncertainty visible.
- Preserve user-approved seller claims separately from AI proposals.
- Keep model and prompt versions for audit and regression analysis.
- Provide a path to reject, correct, or supersede incorrect output.

## 17. Abuse prevention

The product should detect and restrict behavior such as:

- attempts to collect highly sensitive personal data;
- prohibited scraping or access bypass;
- deceptive identity or impersonation;
- spam-scale automation;
- evasion of suppression or opt-out lists;
- phishing, credential theft, or malware delivery;
- discriminatory targeting based on sensitive traits;
- repeated provider or source abuse.

Administrative review and suspension tooling can be basic initially, but the data model should support workspace status and reasoned restrictions.

## 18. Incident readiness

Before production launch, document:

- incident owner and contact path;
- severity levels;
- credential rotation steps;
- provider revocation steps;
- affected-user assessment;
- logging and evidence preservation;
- communication process;
- post-incident review;
- tracked remediation.

## 19. Minimum production checklist

- RLS and authorization integration tests pass;
- no secrets in client bundles or repository history;
- environment validation is enabled;
- rate limits protect authentication and research start operations;
- security headers are configured;
- provider data flows are documented;
- privacy and terms content reflects actual behavior;
- deletion and export paths are defined;
- backups and recovery are documented;
- dependency and secret scanning are enabled;
- prompt-injection boundaries are tested;
- automatic sending remains disabled until its separate checklist is complete.

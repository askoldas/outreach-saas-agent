# Research and AI Pipeline

Company Profile analysis (`company-profile-website-v3-grouped`) first records atomic website facts with source, confidence, origin, page title, passage, and extraction time. It classifies commercial items before grouping them into campaign-worthy offerings; product categories, features, supporting services, capabilities, business models, and relationship models are not promoted to standalone offerings automatically. Deterministic validation then normalises proof and produces at most seven review decisions driven by real commercial ambiguity. Re-analysis creates a new draft version and preserves user-confirmed strategy fields and approved communication rules.

The profile keeps customer types, buyer industries, needs, relationship types, current and potential markets separate. It also separates differentiators, verified claims, strategic direction, commercial constraints, regulatory limitations, and conflicting information. Readiness measures practical prospecting capability rather than extracted-fact or unanswered-question volume; only blocking questions prevent publication.

Profile review questions use explicit stages and durable answered, skipped, or dismissed states. Successful analysis normally produces only an optional grouped-offering review. A blocking profile question is reserved for the absence of any usable offering or a critical identity/structure conflict. Campaign targeting decisions use a separate readiness object and do not reduce Company Profile readiness.

The target pipeline is Company Profile extraction → structured Campaign Strategy → discovery → identity normalization/deduplication → company research → qualification → basic public contact discovery → stable lead review → approved-company enrichment → recipient recommendation → draft generation → CSV export.

The worker persists research runs and bounded retry-safe tasks. Each run references an immutable Campaign Strategy version. Tavily search and OpenRouter evaluation are accessed through server/worker adapters and consume that frozen version. Provider failures remain visible and must not corrupt authorization or workflow state.

AI may interpret seller/source material, propose strategies, extract facts, assess qualification dimensions, and compose grounded text. Deterministic code validates schemas, owns state transitions, freezes used strategy versions, applies exclusions, recommends contacts using declared priority, calculates credit estimates, and prevents unapproved spending or sending.

Every prospect fact needs provenance or an explicit inference label. Fit excludes contactability and evidence quality. Drafts may use only Company Profile claims, the strategy version used, stored prospect evidence, and the selected recipient context.

Current behavior includes durable research tasks, immutable strategy versions linked to runs, provider-backed discovery and contact enrichment, verification provenance, evidence-backed qualification, campaign-scoped review, deterministic recipient recommendations, schema-validated Company Profile and Strategy generation, durable grounded draft generation, immutable usage events, persisted export history, authorized historical CSV downloads, live progress, database integration coverage, and browser-level workflow coverage. CSV bytes are generated locally from frozen records. Deep crawling and paid enrichment vendors remain excluded.

Guided natural-language interpretation uses the separate `guided-change-v1` prompt. It
receives only the current Company or Campaign context, an explicit field allowlist,
allowed operations, and the response contract. Output is validated before display and
again before application. Ambiguous requests must return a clarification question rather
than a mutation. Application code—not the model—owns field mapping, stale-version checks,
new version creation, and audit persistence.

# Research and AI Pipeline

The target pipeline is Company Profile extraction → structured Campaign Strategy → discovery → identity normalization/deduplication → company research → qualification → basic public contact discovery → stable lead review → approved-company enrichment → recipient recommendation → draft generation → CSV export.

The worker persists research runs and bounded retry-safe tasks. Each run references an immutable Campaign Strategy version. Tavily search and OpenRouter evaluation are accessed through server/worker adapters and consume that frozen version. Provider failures remain visible and must not corrupt authorization or workflow state.

AI may interpret seller/source material, propose strategies, extract facts, assess qualification dimensions, and compose grounded text. Deterministic code validates schemas, owns state transitions, freezes used strategy versions, applies exclusions, recommends contacts using declared priority, calculates credit estimates, and prevents unapproved spending or sending.

Every prospect fact needs provenance or an explicit inference label. Fit excludes contactability and evidence quality. Drafts may use only Company Profile claims, the strategy version used, stored prospect evidence, and the selected recipient context.

Current behavior includes durable research tasks, immutable strategy versions linked to runs, provider-backed discovery and contact enrichment, verification provenance, evidence-backed qualification, campaign-scoped review, deterministic recipient recommendations, schema-validated Company Profile and Strategy generation, durable grounded draft generation, immutable usage events, persisted export history, authorized historical CSV downloads, live progress, database integration coverage, and browser-level workflow coverage. CSV bytes are generated locally from frozen records. Deep crawling and paid enrichment vendors remain excluded.

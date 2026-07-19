# Opptium Product Definition

Opptium is a horizontal AI-assisted B2B prospecting and outbound-preparation platform. The locked journey is Company Profile → Campaign → Research → Leads → Approved Companies → Contacts → Outreach Drafts → Export.

Company Profile holds reusable seller identity, products/services, capabilities, customer types, markets, differentiators, proof, approved claims, limitations, and sources. Missing information produces non-blocking warnings. Campaign creation starts with a natural-language brief and may use the full profile or focus on one proposition.

Strategy is structured, editable, and stored as immutable numbered versions. Schema-validated AI refinement proposes a complete structured revision and is never itself the source of truth. A strategy used for research is frozen; later changes create a new version.

Research discovers, deduplicates, researches, and qualifies companies through durable work. Review begins only when the result set is stable. Fit Score is 0–100 with a descriptive band and separate confidence. Contactability and evidence quality are visible but do not change commercial fit.

Lead review is campaign-local with Ready, Approved, Rejected, Excluded, and Research Issues views. Rows expand inline to show evidence, dimensions, public contacts, warnings, and notes. Approval records commercial relevance only; it does not spend enrichment credits or generate drafts.

Deep contact enrichment is explicit after approval and displays a credit estimate. Opptium recommends one primary recipient with fallbacks. Draft generation is explicit and batch-oriented, grounded in Company Profile knowledge, frozen strategy, prospect evidence, and recipient context.

The MVP ends at Outreach CSV and Lead Research CSV export. Automatic sending, mailbox draft creation, follow-ups, reply detection, CRM integrations, production billing, paid enrichment vendors, deep crawling, and document uploads are excluded.

Current implementation status is maintained in `OPPTIUM_REFACTOR_PLAN.md`.

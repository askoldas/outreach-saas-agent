# Opptium Product Definition

Opptium is a horizontal AI-assisted B2B prospecting and outbound-preparation platform. The locked journey is Company Profile → Campaign → Research → Leads → Approved Companies → Contacts → Outreach Drafts → Export.

Company Profile holds reusable seller identity, products/services, capabilities, customer types, markets, differentiators, proof, approved claims, limitations, and sources. Missing information produces non-blocking warnings. Campaign creation starts with a natural-language brief and may use the full profile or focus on one proposition.

Strategy is structured, editable, and stored as immutable numbered versions. Schema-validated AI refinement proposes a complete structured revision and is never itself the source of truth. A strategy used for research is frozen; later changes create a new version.

Research discovers, deduplicates, researches, and qualifies companies through durable work. Review begins only when the result set is stable. Fit Score is 0–100 with a descriptive band and separate confidence. Contactability and evidence quality are visible but do not change commercial fit.

Lead review is campaign-local with Ready, Approved, Rejected, Excluded, and Research Issues views. Rows expand inline to show evidence, dimensions, public contacts, warnings, and notes. Approval records commercial relevance only; it does not spend enrichment credits or generate drafts.

Deep contact enrichment is explicit after approval and displays a credit estimate. Opptium recommends one primary recipient with fallbacks. Draft generation is explicit and batch-oriented, grounded in Company Profile knowledge, frozen strategy, prospect evidence, and recipient context.

The MVP ends at Outreach CSV and Lead Research CSV export. Automatic sending, mailbox draft creation, follow-ups, reply detection, CRM integrations, production billing, paid enrichment vendors, deep crawling, and document uploads are excluded.

The Usage page reports descriptive workspace funnel metrics from persisted product
events. Response rate and willingness-to-pay are not inferred because the application
does not send outreach or collect commercial research responses.

Current implementation status is maintained in `OPPTIUM_REFACTOR_PLAN.md`.

## AI-guided setup

Company setup and Campaign creation use a hybrid guided model: one focused commercial
decision, recommended structured choices, an Other/natural-language path, and a live
summary of the persistent object. AI interpretations are rendered as validated proposed
changes and materially important values require explicit Apply. The conversation is not
the source of truth; Company Profile versions, campaign overrides, and Strategy versions
remain authoritative and directly editable.

Company setup adapts around detected offerings and unresolved review questions. Campaign
setup begins with a selected Offering, then captures objective, segment, markets, buyer
personas, qualification, exclusions, and a reviewable discovery strategy. Campaign
overrides do not mutate the master Company Profile.

A completed Campaign setup consumes its guided draft. Opening Create campaign again
starts at Offering selection and never silently reuses the prior Campaign's market,
segment, or review step. Incomplete drafts may still be resumed.

Website analysis now classifies and groups related commercial items before review. Company setup normally asks a small set of decisions about offering structure, active prospecting propositions, markets, relationship types, commercial requirements, and genuine source conflicts. Optional wording and additional proof do not block publishing. “Improve profile structure” creates a new draft while retaining published campaigns and user-defined prospecting preferences.

Responsibility boundary: Company Profile explains the stable business and can be used immediately after successful analysis. It does not require prospecting markets, buyer-persona confirmation, campaign qualification, or messaging decisions. Campaign creation owns the selected offering, objective, relationship type, target markets, segment, buyer roles, qualification, exclusions, and discovery strategy. Campaign choices remain campaign-local unless the user explicitly selects “Save as offering defaults”; operating-market facts are never overwritten.

# Organization-first discovery principle

Opptium may store consumers as part of a company’s existing audience, but every
discovery Campaign must target a searchable B2B relationship: customer organization,
partner, distributor, reseller, supplier, contractor, or public institution.

The Company Profile may truthfully record that a company currently serves individuals.
That fact must not automatically become a Campaign target. A consumer business can
instead confirm an organization-buyable offering and target supported relationships
such as employers, corporate buyers, retailers, distributors, resellers, partners, or
institutions.

The organization that buys, the person who decides, and the person who uses or benefits
from an Offering are separate concepts.

# AI-guided setup interaction

The canonical interaction is:

> AI proposes → user selects and adjusts → AI interprets additions as structured
> changes → user confirms → Opptium saves a versioned result.

Natural-language input is never a direct database mutation. Additive language preserves
confirmed items by default. Explicit replacement is shown as a replacement preview and
still requires confirmation.

## Intelligence V2 rollout status

The accepted Intelligence V2 direction is documented under `docs/V2/`. It replaces
fixed generic discovery refinement and holistic model scoring only when the
corresponding V2 workflow stages pass their rollout gates. Existing campaigns remain
V1 and keep their current behavior; new V2 behavior is stage-flagged, workspace-scoped,
version-frozen, and disabled by default.

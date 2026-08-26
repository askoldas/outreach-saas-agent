# Core Intelligence Refactor

## Product and engine boundaries

The user-facing Campaign flow is:

```text
Company Profile
-> Campaign Setup
-> Market Analysis
-> Company Discovery
-> Company Analysis & Qualification
```

Contact enrichment and outreach remain separate downstream systems.

The internal intelligence flow is:

```text
Company Profile Snapshot
-> Commercial Intelligence
-> Campaign Target Model
-> Market Analysis
-> Market Research Plan
-> Source Records and Source Artifacts
-> Organization References
-> Canonical Organizations
-> Research Blueprints
-> Company Intelligence
-> Qualification
-> Ranking
```

Market Analysis is a persisted, user-visible explanation of the target market. Market
Research Plan is the internal execution strategy derived from it. Discovery providers
produce source records and Organization References, never final Campaign organizations.

## Package 1: contract boundary

Package 1 adds provider-independent schemas under `src/lib/intelligence/core/`. It does
not migrate persistence or change the active Campaign runtime. The contracts establish:

- reusable Commercial Intelligence compiled from Company Profile V3;
- a Campaign Target Model separate from market and execution planning;
- distinct Market Analysis and Market Research Plan artifacts;
- explicit multi-role source semantics and Organization References;
- reusable archetype Research Blueprints;
- Company Intelligence that describes an organization without qualifying it;
- independent commercial-relationship dimensions;
- common immutable artifact version metadata and content hashes.

The existing local adaptive-cycle and source-expansion work remains valid downstream of
Market Research Plan. Its current `normalizedCandidates` persistence is a compatibility
surface; later packages will expose it through Organization Reference repositories before
changing storage.

## Compatibility rules

- Company Profile V3 remains the seller source of truth.
- Campaign Strategy V2 remains the frozen compatibility envelope while consumers move to
  the new artifacts.
- Existing `market_analyses`, discovery, organization, candidate-intelligence,
  qualification, ranking, and checkpoint history is preserved.
- Unknown is not negative evidence.
- Organization roles and Campaign relationships are non-exclusive.
- A source URL is not an organization identity or official website without separate
  identity evidence.
- Historical artifacts are never recomputed or overwritten automatically.

## Next package

Package 2 adds forward-only persistence and workspace-scoped repositories for Commercial
Intelligence, Campaign Target Model, V2 Market Analysis, Market Research Plan, and
Research Blueprint versions. The existing `market_analyses` table is extended with
nullable V2 references so historical records remain readable. New artifact tables are
insert-only, member-readable, service-written, workspace-guarded, and cache-keyed by
frozen input plus schema/compiler versions.

Migration `20260824000400_core_intelligence_artifacts_v2.sql` is intentionally not
applied automatically.

## Next package

Package 3 adds a deterministic Company Profile V3 to Commercial Intelligence compiler.
It projects active offerings, non-rejected buyer archetypes, commercial relationships,
operational use cases, signals, scoped rules, evidence, confidence, and unresolved
critical conflicts without another AI call. The service loads the exact current
published native V3 version, validates its workspace and row identity, and reuses the
immutable artifact cache before creating another stored version.

## Package 4: Campaign Target Model

Package 4 deterministically compiles a Campaign Target Model from the exact immutable
Commercial Intelligence version plus confirmed Campaign inputs: selected offerings,
objective, geography, and constraints. Offering-specific archetypes retain their source
priority and non-exclusive relationship hypotheses. Only confirmed, applicable rules can
become exclusions; unknowns remain qualification requirements and unresolved questions.

The persistence service loads Commercial Intelligence by workspace and immutable ID,
uses the Campaign-scoped cache/version repository, and can validate a supplied Campaign
Strategy V2 as a compatibility projection before persistence. It is intentionally not
wired into discovery yet.

## Package 5: user-visible Market Analysis

Package 5 reuses the validated, bounded Campaign market-context task as its model
interpretation layer, then deterministically compiles that output with the exact Campaign
Target Model. Frozen targeting identity, archetypes, signals, evidence scope, hashes, and
model provenance cannot be rewritten by model output. Unsupported source labels remain
explicitly `other`, and data gaps remain unknowns rather than negative evidence.

Every newly compiled Market Analysis requires explicit user confirmation before research
planning. Confirmation is a separate immutable, user-attributed record, so the analysis
itself remains unchanged. The service loads the immutable Target Model by workspace and
ID and persists a Campaign Run-scoped, immutable version in the evolved
`market_analyses` table. Discovery routes remain absent from this user-facing artifact.

## Package 6: internal Market Research Plan

Package 6 deterministically compiles provider-executable discovery and verification
routes from an explicitly confirmed Market Analysis, its exact Campaign Target Model,
and immutable provider capability snapshots. Every route records the capability snapshot
IDs that can execute it, applicable provider source types, languages, vocabulary, source
hints, expansion mode, expected coverage, and archetype scope.

Unsupported geography/provider combinations cannot silently create routes. Identity
verification remains a distinct official-website route, while redirect criteria, stop
signals, and coverage risks remain internal execution policy. This compiler makes no
model call and never places discovery routes back into Market Analysis.

## Package 7: discovery compatibility adapter

Package 7 makes new discovery runs prefer a Market Research Plan that existed when the
Campaign Run was created. The adapter retains Strategy V2 segment and qualification
identity while replacing dynamic route selection with the plan's frozen provider routes,
capability snapshots, vocabulary, and source hints. The resulting Discovery Plan records
the Market Research Plan version in its content hash and persisted snapshot.

Existing persisted Discovery Plans are replayed unchanged. Runs without an eligible
Market Research Plan continue through the prior Strategy-based planner, preserving
historical and partially migrated Campaign compatibility. A run-scoped research plan is
never borrowed by another run.

## Package 8: Organization References

Package 8 introduces immutable, workspace-scoped Organization References between
normalized provider output and canonical Entity Resolution. Every settled normalized
candidate materializes one reference with its source record, provider execution, optional
source-expansion lineage, source roles, identity hints, geography and business hints,
matched archetype and Segment IDs, extraction provenance, and confidence.

Entity Resolution now consumes validated Organization Reference contracts. A website
hint from a directory remains only a hint; it can become a safe canonical domain only
when the reference carries first-party identity evidence. Existing direct and expanded
normalized candidates remain the compatibility source from which references are
materialized. Organization Reference persistence never creates or merges canonical
organizations.

## Package 9: Research Blueprints

Package 9 deterministically compiles one reusable Research Blueprint for every compatible
Target Model archetype. Each immutable blueprint is bound to the exact Target Model and
Market Analysis versions and defines reusable organization questions, evidence roles,
source preferences, operational signals, exclusion checks, and bounded stopping criteria.

Candidate research loads only blueprints attached to the run-eligible Market Research
Plan and only applies those matching a candidate's archetypes. Blueprint questions retain
organization scope and their version IDs are frozen into the Candidate Research Plan.
Campaign Strategy qualification and factor questions retain `campaign_only` scope and
take precedence on key collisions, preventing Campaign judgments from entering reusable
Company Intelligence.

## Package 10: Company Intelligence compilation

Package 10 adds a deterministic compiler that projects only organization-scoped Candidate
research claims into the reusable Company Intelligence contract. The artifact retains
identity, operational facts, evidence, contradictions, unknowns, confidence, and exact
Research Blueprint provenance. Campaign-only claims are excluded at the compiler boundary;
eligibility, fit, potential, and rank remain absent.

Company Intelligence versions are stored in a new immutable, workspace-guarded table and
remain linked to the exact legacy Candidate Intelligence source version. This preserves the
existing Qualification compatibility path while enabling a controlled downstream cutover.
Migration `20260824000600_company_intelligence_artifacts_v2.sql` is intentionally not
applied automatically.

## Package 11: Company Intelligence runtime activation

Package 11 activates replay-safe Company Intelligence compilation immediately after a
Candidate research member produces its legacy immutable snapshot. Qualification preparation
ensures or reuses the exact Company Intelligence artifact, freezes its ID and content hash
into the candidate input hash, and validates that its reusable claims remain present in the
legacy Campaign projection.

Qualification still retains Campaign-only research claims for relationship, exclusion, and
factor evaluation. Historical research snapshots without Research Blueprint provenance use
the legacy projection, while new runs require and bind the new reusable artifact. Final
qualification snapshots record both version identities.

## Package 12: Commercial Relationship assessments

Package 12 deterministically compiles an immutable, Campaign-scoped relationship assessment
from the exact Company Intelligence and Campaign Target Model versions. Manufacturer, buyer,
supplier, distributor, retailer, reseller, partner, competitor, and other relationships are
stored as independent dimensions rather than one exclusive primary label.

Explicit reusable organization-role evidence can confirm a dimension. A matched target
archetype can make one possible but cannot prove it, and the Campaign's desired relationship
alone remains unknown with zero confidence. Each assessment freezes matched archetypes,
evidence, uncertainty, input hashes, and both source artifact versions. Migration
`20260824000700_commercial_relationship_assessments_v2.sql` is intentionally not applied
automatically.

## Package 13: relationship-aware Qualification

Package 13 compiles or reuses one exact Commercial Relationship assessment per Qualification
candidate using the run-eligible Target Model and the candidate's frozen matched archetypes.
Its artifact ID and content hash enter the Qualification input hash, and the assessment is
bound durably to both the Qualification member and pending evaluation version.

Relationship reasoning receives every independent dimension as an evidence-bounded prior.
It still emits the existing primary/secondary relationship shape as a compatibility
projection for current eligibility, ranking, and UI consumers. Campaign-only research
claims remain available, and historical batches without a relationship assessment continue
through the legacy path. Migration
`20260824000800_bind_qualification_relationship_assessments_v2.sql` is intentionally not
applied automatically.

## Package 14: result artifact lineage

Package 14 projects the exact Qualification evaluation, legacy Candidate Intelligence,
Company Intelligence, Campaign Target Model, and Commercial Relationship assessment version
identifiers into each Campaign result. It also exposes the persisted multi-dimensional
relationship assessment in stable relationship-type order. Evaluations created before the
new binding remain readable with nullable Core Intelligence identifiers.

Ranking remains deterministic, lane-first, and free of model calls. This package changes the
read projection only and requires no migration.

## Package 15: explainable result details

Package 15 surfaces every persisted Commercial Relationship dimension inside the existing
Campaign result inspector, including state, confidence, rationale, evidence counts, and
unresolved questions. Exact artifact identifiers are available in a nested Artifact lineage
disclosure so the primary result table remains compact.

The existing primary-relationship summary remains unchanged. Historical evaluations render an
explicit unavailable state for relationship dimensions and nullable Core Intelligence
versions instead of fabricating or recomputing them.

## Package 16: dimension-aware relationship corrections

Package 16 separates relationship corrections from generic candidate corrections. Each new
relationship proposal names one persisted relationship dimension and binds to the exact
Commercial Relationship assessment used by Qualification. The database validates workspace,
Campaign, candidate organization, evaluation, assessment, and dimension lineage before
accepting the append-only proposal and audit event.

Historical correction rows remain valid with nullable source fields. New non-relationship
corrections cannot claim relationship provenance, and no correction mutates frozen Company
Intelligence, Qualification, or Ranking artifacts. Migration
`20260824000900_dimension_aware_relationship_corrections_v2.sql` is intentionally not applied
automatically.

## Package 17: relationship correction provenance

Package 17 projects dimension-aware relationship correction proposals back into each Campaign
result. Proposals appear beneath their exact persisted relationship dimension with status,
proposed value, reason, and full source assessment identifier.

The frozen assessment remains the authoritative displayed result. Correction proposals are
visually and structurally separate, carry an explicit non-mutation notice, and never overwrite
relationship state, confidence, rationale, Qualification, or Ranking. This package requires no
migration.

## Package 18: direct Qualification lineage and compatibility audit

Package 18 binds the exact Company Intelligence version directly to every new Qualification
member and pending evaluation alongside its Commercial Relationship assessment. Qualification
workers load that frozen version directly; lookup through legacy Candidate Intelligence remains
only as an explicit fallback for historical unbound members. Campaign results prefer the direct
evaluation binding and retain assessment-derived fallback for historical rows.

The cross-stage audit is recorded in `CORE_INTELLIGENCE_COMPATIBILITY_AUDIT.md`. It identifies
the remaining legacy Candidate Intelligence reads as source-adapter or historical-compatibility
boundaries rather than canonical decision paths. Migration
`20260824001000_bind_qualification_company_intelligence_v2.sql` is intentionally not applied
automatically.

## Package 19: release-readiness closure

Package 19 adds executable cross-stage release contracts and closes the refactor with
`CORE_INTELLIGENCE_RELEASE_READINESS.md`. The audit covers the ordered migration chain, direct
Qualification lineage with historical fallback, deterministic model-free Ranking, and nullable
Campaign result compatibility.

Hosted database type generation was attempted but could not complete in the current CLI
environment; the existing generated file was left untouched. This is recorded as a deployment
follow-up rather than hidden behind hand-edited generated types.

## Refactor status

The planned Core Intelligence refactor is complete. No further Core Intelligence migration is
pending. Subsequent work should be treated as operational rollout, monitoring, or separately
scoped product development.

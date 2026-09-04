# Commercial research pipeline

The active V2 Company Research flow is:

```text
initialize
  -> compile commercial opportunity and open hypotheses
  -> freeze run-scoped market guidance and provider plan
  -> adaptive broad discovery reservoir
  -> entity resolution
  -> cheap commercial triage and early suppression
  -> bounded candidate research
  -> relationship-first qualification
  -> lane-first fit/potential/timing ranking
  -> adaptive continuation or review
```

The first-cycle market bootstrap is a retry-safe prerequisite for discovery. Its
artifacts remain campaign/run scoped and are not promoted into global Company Profile
truth. Provider capabilities, budgets, evidence IDs, source provenance, query
fingerprints, and checkpoints remain frozen and auditable.

## Projection map

Pass 1 establishes the commercial opportunity contract across these projections. The
profile task now captures organization archetypes as explicit initial hypotheses and
retains their business roles, models, industries, buyer conditions, scale signals,
buying triggers, decision roles, evidence, and confidence. Offering projections retain
identity and descriptions, value proposition and expected outcomes, problems and use
cases, buyer conditions, relationship mechanics, scale drivers, buying triggers,
decision roles, and procurement patterns. Hypothesis origin and status remain explicit
so projected assumptions cannot silently become confirmed facts.

The boundary is intentional: rejected or superseded archetypes, inactive offerings,
presentation-only copy, persistence metadata, and non-selected offerings in a campaign
target are not carried forward. No data migration is required because the additions are
optional/defaulted fields inside the existing versioned structured documents.

## Market opportunity lane lifecycle

Pass 2 treats Campaign Target archetypes as initial hypotheses rather than the complete
market. Market Analysis compiles a run-scoped Market Opportunity Map whose lanes record
their origin (`initial_target` or `market_research`), disposition, rationale, evidence
and counter-evidence, scale drivers, buying triggers, vocabulary, and confidence.
Supplied market evidence may promote, downgrade, or reject an initial lane and may add a
new lane inside the frozen offering, geography, objective, relationship types, and hard
constraints. Unsupported model-proposed priority lanes are deterministically downgraded
to exploratory status.

Rejected and weak lanes remain in the map for auditability; they are not silently
deleted. Historical Market Analysis JSON remains readable through schema defaults, so
this contract change does not require a Supabase migration. External market retrieval
and routing candidate discovery from the resulting lanes remain separate execution
passes.

## External market reconnaissance

Pass 3 adds a bounded reconnaissance step between Campaign Target compilation and
Market Opportunity Map synthesis. It deterministically asks three question families:
buyer landscape and adjacent sectors, market structure and authoritative sources, and
scale or timing signals. Each query is executed through the research-credit boundary,
and its source URL, title, bounded excerpt, retrieval time, relevance score, provider
request ID, and provider-credit usage are retained in a run-scoped evidence corpus.

The corpus is cached by the exact Target Model content and compiled questions, making
Trigger retries safe. Its evidence IDs are explicitly allowlisted for Market Analysis;
retrieved page content remains untrusted model data. This stage may surface
representative organizations as evidence, but it does not create candidate records or
replace broad company discovery.

The corpus requires `market_research_executions_v2`, introduced by migration
`20260904000100_market_research_evidence_corpus.sql`. Apply it in migration order before
deploying the completed workflow.

## Opportunity-lane discovery planning

Pass 4 compiles Market Research Plan routes from active Market Opportunity Map lanes,
not only from the Strategy's initial archetypes. Priority, secondary, and exploratory
lanes receive provider-bound routes; weak and rejected lanes remain auditable in Market
Analysis but do not consume discovery budget. A market-discovered lane becomes a
first-class semantic discovery segment carrying its organization type, business models,
industries, local vocabulary, scale drivers, buying triggers, relationship objective,
source hints, and evidence rationale.

Existing archetype-backed segments retain their stable Strategy identity and gain an
`opportunityLaneId`. Newly discovered lanes use that lane ID as their compatibility
archetype key until downstream lane-aware qualification is compiled. Historical
archetype-only Market Research Plans remain readable and executable. Because plans and
segments are already persisted as versioned JSON, Pass 4 requires no Supabase migration.

| Projection                                 | Preserved or transformed                                                                                                                                                                               | Intentionally omitted                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Company Profile V3 -> planning profile     | Offering mechanics, problems, outcomes, required/preferred/incompatible conditions, triggers, procurement pattern, relationship options, archetype roles/models/industries/signals/conditions/evidence | Rejected and superseded archetypes                              |
| Planning profile -> commercial opportunity | Seller roles/capabilities, offering conditions, buyer hypotheses, buying and negative signals, scale drivers, rules, evidence and confidence                                                           | Presentation-only wording and database row metadata             |
| Commercial opportunity -> target model     | Selected offering, desired relationships, hypothesis rationale, operational need, positive/negative/scale signals, rules and geography                                                                 | Non-selected offerings and relationship-incompatible hypotheses |
| Target/market plan -> discovery            | Active opportunity lane, geography, source family, language, terminology, scale/timing vocabulary, provider capability snapshot and explicit candidate reservoir target                                | Weak/rejected lanes and provider-specific syntax                |
| Discovery -> triage                        | Resolved identity, lane matches, reusable claims, scale/timing proxies, negative evidence and known relationship signals                                                                               | Contactability and website quality as commercial value          |
| Triage -> deep research                    | Only non-suppressed candidates ordered by commercial opportunity; researchability is retained separately                                                                                               | Confirmed existing customers and excluded relationships         |
| Qualification -> ranking                   | Eligibility/review lane, relationship, fit, potential, evidence confidence and opportunity timing                                                                                                      | Contact enrichment and outreach readiness                       |

## Reservoir and stopping

Pass 5 replaces the fixed discovery multiplier with a market-aware reservoir policy.
The target starts with the requested qualified-company outcome, then accounts for
expected duplicate and qualification-rejection loss, the assessed market breadth, and
the estimated candidate range. Lane selection expands for broader markets and repeated
cycles, while provider-call sizing can use observed unique-candidate yield and subtract
candidates already collected. Every calculation remains capped by the frozen run
budget.

The resulting per-lane `targetUniqueCandidates` is persisted in every coverage cell and
carried into later discovery passes. Targeted result limits are based on the remaining
gap rather than a single global result limit. Continuation still stops on sufficient
coverage, exhausted call/deadline/pass budgets, fatal provider failure, cancellation,
or consecutive low marginal-yield passes. This pass changes versioned JSON contracts
only and requires no Supabase migration.

## Candidate triage and timing

Pass 6 makes commercial triage the admission boundary for expensive Candidate Research.
The stage loads the normalized discovery evidence already associated with each resolved
Campaign Candidate: employee count, industries, keywords, matched signals, and bounded
operating-company/geography plausibility. It combines that evidence with active market
lane priority, lane-specific scale drivers and buying triggers, prior reusable claims,
and hard relationship evidence. This is a deterministic, provider-neutral assessment.

Known customers, excluded relationships, and high-confidence non-operating or
out-of-market records are suppressed before research. Candidates below the commercial
threshold remain on hold and no longer consume the deep-research ceiling. Priority
market-discovered lanes are accepted directly instead of being rejected for lacking a
legacy Strategy archetype. Domain availability and source richness form a separate
researchability measure and cannot raise commercial priority. The triage evidence is
read from existing normalized discovery tables, so Pass 6 requires no Supabase
migration.

## Supporting-source candidate research

Pass 7 makes deep Candidate Research explicitly dual-source. First-party pages still
establish identity, operations, offerings, locations, and direct commercial facts. A
separate bounded supporting-search plan now investigates account scale and dated buying
triggers such as expansion, investment, procurement, tenders, relevant hiring, and
appointments. Opportunity-lane trigger vocabulary is carried into the queries; the
domain contract remains provider-neutral even though Tavily is the current adapter.

Supporting results must be off-domain HTTPS pages with usable content and minimum
relevance. They are capped per candidate, deduplicated by canonical URL, charged through
the research-credit boundary, and persisted independently from first-party and original
Discovery evidence. Each record retains its provider/request provenance, evidence type,
retrieval date, and publication date when supplied. Retries reload the persisted corpus
instead of silently losing third-party evidence.

Timing extraction distinguishes publication time from retrieval time. Volatile claims
inherit the cited source publication date; undated sources remain freshness `unknown`,
so old or undated news cannot become current merely because it was researched today.
This behavior requires migrations
`20260904000200_candidate_supporting_research_sources.sql` and
`20260904000300_candidate_claim_observation_dates.sql`.

Ranking remains eligibility- and review-lane-first. Within a lane it orders by fit,
commercial potential, evidence-backed opportunity timing, confidence, directness, and a
stable identifier. Timing is zero when no relevant supported factor exists; recent but
commercially irrelevant content does not receive a timing score.

## Qualification and final ranking integration

Pass 8 closes the Candidate Research-to-ranking contract. Qualification now always
includes three supporting commercial dimensions—account scale, geographic reach, and
current trigger strength—even when an older frozen Strategy contains only fit factors.
The generic `commercial_scale` and `opportunity_timing` research findings are explicitly
bound to those factors, so a model conclusion can only affect the score when it cites a
verifiable claim and linked evidence.

Qualification persists a deterministic opportunity-timing snapshot alongside fit,
commercial potential, and confidence. Its score combines trigger strength, factor
confidence, evidence quality, and the evidence freshness class. Undated evidence has
zero timing weight, while stale evidence is heavily discounted. Ranking keeps the
review lane as the primary boundary, then orders within that lane by fit, potential,
timing, confidence, evidence directness, and a stable candidate identifier. Therefore a
high-potential excluded, rejected, invalid, duplicate, or unresolved candidate cannot
jump into the recommended lane.

This pass only extends existing versioned rubric and final-snapshot JSON. It does not
require a Supabase migration. The three migrations listed above can be applied before a
single final Trigger.dev deployment; no per-pass deployment is required.

## Adaptive market-research waves

The follow-up refactor upgrades the run-scoped reconnaissance corpus from one fixed
query batch to two normal evidence-linked waves, with an optional third gap-recovery
wave. Wave 1 establishes buyer landscape, market structure, sources, scale, and timing.
Wave 2 derives source-specific and terminology-bearing searches from the strongest
Wave 1 evidence rather than replaying the initial templates. Wave 3 is created only when
a priority initial hypothesis still has no corpus coverage.

The frozen policy caps waves, queries per wave, total provider calls, retained evidence,
and elapsed runtime. Every question records its wave, direction, and parent evidence
IDs; every wave records its questions, evidence, and explicit priority gaps. The exact
policy participates in the retry cache hash. These additions use the existing
`market_research_executions_v2.corpus_json` artifact and require no Supabase migration.

## Named market sources and typed commercial signals

Market synthesis can now return evidence-backed named sources with a stable source ID,
family, URL, intended use, applicable opportunity lanes, confidence, and supporting
evidence IDs. Unsupported source evidence fails compilation. Candidate-discovery
sources are copied into the immutable Market Research Plan and create lane-specific
routes and domain-constrained web queries; sources intended only for validation or
timing are retained without being misused as candidate directories.

Opportunity lanes now retain typed `scale_driver`, `buying_trigger`, and `need_signal`
objects alongside their backward-compatible text fields. Discovery segments keep these
objects separate from generic keywords, and query generation translates them into
purpose-labelled searches without discarding the original key or type. Candidate
triage consumes typed scale and trigger signals, and the selected Candidate Research
source plan freezes them for its evidence-extraction context. Qualification continues
to map scale and timing findings into deterministic potential and trigger factors. All
additions are stored in existing versioned JSON artifacts, so this pass requires no
Supabase migration.

## Pre-research relationship suppression

Candidate Research now loads workspace-scoped relationship memory before admitting a
candidate to deep research. Exact organization IDs and canonical domains are preferred;
normalized-name matching is exact and limited to high-confidence, evidenced aliases.
Confirmed existing customers, competitors, and explicit user exclusions are suppressed.
Probable or ambiguous relationships, former customers, and partners are held for review
instead of being silently excluded. Fuzzy name similarity never suppresses a candidate.

The service-role loader only uses finalized or manual-review qualification assessments,
requires evidence for a confirmed stored relationship, and rejects cross-workspace
campaign access. Legacy relationship claims must also be active, non-stale facts or
evidence-backed inferences before they can suppress research. This pass requires
`20260904000400_pre_research_relationship_suppression.sql`.

## Durable candidate triage

Every resolved Campaign Candidate now receives an immutable, cycle-scoped triage row
before the deep-research subset is selected. The row preserves the commercial score,
component contributions and explanations, suppression reasons, relationship status,
research difficulty, supporting evidence IDs, policy version, and deterministic input
hash. Deep-research, hold, and suppress outcomes therefore remain queryable even when a
candidate never enters a Candidate Research batch.

Persistence validates complete coverage of the resolved candidate pool and the frozen
campaign identity, is retry-safe, and rejects changed inputs for an existing cycle. A
pool containing only held or suppressed candidates can freeze an empty research batch
and complete without spending research budget. This pass requires
`20260904000500_candidate_triage_decisions.sql`.

## Provenance and fail-closed discovery

Native Strategy archetypes now retain the evidence IDs of the matched Company Profile
buyer archetype. The Strategy projection carries those IDs into Target Model archetypes
and Market Analysis combines this genuine upstream hypothesis support with its own
validating or counter evidence. Derived signals do not inherit evidence unless that
evidence specifically supports the signal; unsupported links are not synthesized.

Normal V2 initial Discovery now requires its frozen Market Research Plan and throws a
domain-specific `MissingMarketOpportunityPlanError` when that prerequisite is absent.
The Strategy-only compiler remains available solely through the explicit
`allowLegacyStrategyDiscovery` option, which the production V2 workflow does not set.

The observation-date migration now declares the entire Candidate Research completion
function explicitly. It no longer reads or modifies `pg_proc` source text. The complete
definition retains tenancy checks, replay behavior, evidence/AI provenance validation,
claim persistence, snapshot hashing, and service-role permissions while preserving a
cited `observedAt`; undated volatile claims receive SQL `NULL` and freshness `unknown`.
Because the intended observation-date function was already applied, this repository
cleanup requires no additional migration on an existing environment.

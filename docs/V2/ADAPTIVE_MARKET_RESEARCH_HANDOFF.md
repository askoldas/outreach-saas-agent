# Adaptive Market Research V2 — Implementation Handoff

## Delivered architecture

The native V2 Campaign flow no longer uses a requested company count as its business
stopping rule. It now separates broad discovery, source-page expansion, entity resolution,
cheap candidate prioritization, bounded deep research, qualification, ranking, and an
immutable cycle decision.

Candidate preclassification is conservative: commercial-role and ccTLD hints can affect
priority or route a record to review, but do not reject a plausible buyer. Confirmed hard
exclusions and invalid entities still reject. Directory and list pages are expanded into
durable organization references with source lineage and resumable offsets.

Research runs in bounded, prioritized waves. Every selected organization receives the same
Candidate Research quality contract. Completed candidates, source artifacts, evidence,
AI outputs, discovery fingerprints, and entity-resolution results remain reusable.

## Budget and stopping behavior

The centralized temporary test-cycle budget is:

- 30 provider calls
- USD 2.00 reported AI cost
- 500,000 combined AI tokens as a safety ceiling
- 40 deeply researched candidates
- 45 runtime minutes

These are ceilings, not targets. Each cycle records provider calls and records, AI tokens
and cost, fetched pages, new organizations, deep-research and qualification counts, runtime,
lane yields, remaining candidates, source expansions, and actionable gaps.

The controller prioritizes strong unresearched candidates before buying more discovery. It
then prefers partially expanded sources, followed by actionable discovery gaps. It stops on
budget exhaustion, saturation, two consecutive waves below 20% review-ready yield, or no
actionable work. The persisted outcome explains whether additional opportunity remains.

## Continuation behavior

“Continue research” preserves the Campaign Run and reserves one immutable child cycle under
an advisory lock. Concurrent clicks cannot create duplicate cycles, and a dispatch retry
reuses the existing reservation. The previous decision selects the continuation work:

- `research_existing_pool` and budget-limited continuation run research, qualification, and ranking.
- `discover_more` runs discovery and entity resolution before research, qualification, and ranking.
- `expand_source_pages` resumes the discovery/source-expansion path before downstream stages.

Cycle-specific batches, ranking snapshots, task idempotency keys, and checkpoints retain all
prior results without overwriting history or re-researching completed candidates.

## Applied migrations

1. `20260813000100_discovery_source_expansion_v2.sql`
2. `20260813000200_adaptive_research_cycles_v2.sql`
3. `20260813000300_bounded_candidate_research_batches_v2.sql`
4. `20260813000400_cycle_aware_research_artifacts_v2.sql`
5. `20260813000500_bind_research_artifacts_to_active_cycle_v2.sql`
6. `20260813000600_reserve_campaign_research_continuation_v2.sql`

Latest Trigger.dev deployment: `20260813.12` with 11 tasks.

## Known limitations

- Source expansion and generic targeted discovery currently share the existing discovery
  stage boundary; they are selected by the persisted action but are not separate Trigger tasks.
- “Strong remaining” uses persisted deterministic/preclassification signals, not a newly
  introduced LLM stage.
- Provider-reported cost accuracy depends on each provider adapter populating the existing
  usage fields.
- The commercial credit product and billing conversion remain intentionally out of scope.
- Historical count fields remain in storage for V1/read compatibility but do not control
  native V2 execution.

## Recommended benchmark Campaigns

Run at least these Campaign shapes before tuning the temporary budget:

1. A narrow local market with reliable official directories.
2. A cross-border direct-buyer market where manufacturer/distributor roles overlap.
3. A broad SaaS market dominated by generic web results and duplicates.
4. An exhibitor- or association-heavy industrial market with large source pages.
5. A sparse professional-services market expected to saturate below the budget ceiling.

For every cycle record provider calls/errors, source records and unique URLs, query/source
families and languages, extracted organizations, new/duplicate organizations, source-page
expansion yield, fetched/reused pages, AI tokens and reported cost, research/qualification
counts, all lane counts, review-ready and recommended yield, rejection rate, runtime, stop
reason, remaining strong candidates/gaps/sources, and the effect of continuation. These
measurements should drive the eventual commercial budget-to-credit mapping.

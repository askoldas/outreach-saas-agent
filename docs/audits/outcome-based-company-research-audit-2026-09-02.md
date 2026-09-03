# Outcome-based Company Research current-state audit

Audit date: 2026-09-02  
Branch: `research_improvement`

## Scope and method

This document records Pass 1 of the outcome-based Company Research refactor. It traces
the current implementation rather than an earlier specification, identifies reusable
behavior, records conflicts with the new product contract, and assigns every major
acceptance area to an implementation layer and test boundary.

This pass intentionally makes no additional production behavior changes. The worktree
was already dirty when the outcome refactor began. Those changes are preserved and are
classified below instead of being overwritten.

The older `docs/audits/current-state-audit.md` describes the repository before the
Trigger.dev and Intelligence V2 refactors. It remains historical context and is not an
accurate description of the current runtime.

## Executive finding

The repository already contains most of the expensive technical foundation required by
the new product direction:

- a canonical V2 Campaign Run with frozen Strategy and Company Profile references;
- provider-neutral discovery contracts and immutable capability snapshots;
- Tavily implemented as the current `web_search` provider;
- source-page inspection that can extract multiple organization references;
- organization-reference persistence, entity resolution, canonical companies, and
  campaign-local candidate links;
- deterministic preclassification and candidate prioritization before deep research;
- bounded candidate-research waves, qualification, comparative ranking, and progressive
  result persistence;
- an adaptive multi-cycle controller driven by remaining candidates, discovery gaps,
  source expansion, saturation, marginal yield, and deterministic safety limits;
- a provider-neutral usage ledger with actual cost, billable cost, product credits,
  reservations, and idempotent per-operation settlement;
- internal provider economics and progressive research UI;
- Contact Enrichment as a separate downstream authorization scope.

The implementation is not yet outcome-based end to end. Campaigns and Campaign Runs
already carry a desired company count, but it is not the authoritative scheduling,
completion, settlement, or continuation contract. Incremental research-credit
authorization and budget pause/reopen behavior remain first-class runtime concepts.

## Current end-to-end flow

```text
CampaignBriefForm
  -> createCampaignAction
  -> campaigns.target_volume
  -> native Campaign Strategy V2 draft
  -> explicit Strategy confirmation
  -> CampaignControls
  -> discoverCampaignLeadsAction
  -> create_clean_campaign_run(desired_company_count)
  -> campaign_runs.metadata.desiredCompanyCount
  -> research_credit_cap assigned to the run
  -> execute-campaign-v2 Trigger task
       -> initialize
       -> semantic discovery
       -> entity resolution
       -> candidate research
       -> qualification
       -> comparative ranking
       -> adaptive next-action decision
       -> another bounded cycle or ready_for_review
  -> progressive Company Research and company-result UI
```

### Campaign setup and quantity

`CampaignBriefForm.tsx` owns geography, objective, offering, organization targets,
qualification inputs, exclusions, and the final review step. `createCampaignAction`
creates the campaign and native Strategy draft. The canonical campaign quantity is
stored in `campaigns.target_volume`; repositories expose it as `desiredLeadCount` and
Strategy V2 may also project `coverageTarget.minimumQualifiedCandidates`.

The current prototype adds explicit 25, 50, 100, and custom choices plus a quote. This
is directionally correct, but Pass 2 must decide one authoritative quantity contract
and remove ambiguity between `target_volume`, Strategy coverage targets, and Run JSON.

### Strategy and discovery strategy

Campaign Strategy V2 already contains:

- target geography and working languages;
- commercial relationship archetypes;
- semantic discovery segments;
- per-segment exploration budget class and optional candidate target;
- provider routes and source categories;
- coverage targets, exclusions, qualification factors, evidence questions, and
  stopping policy.

`plan-discovery.ts` freezes provider capabilities and routes segments to implemented
providers. The configured registry currently contains only `WebSearchProvider`.
Capability snapshots and provider routes are persisted. Market Overview enrichment is
dispatched independently and does not block initial discovery.

This is already a provider/channel abstraction, but the persisted state is framed as a
discovery plan rather than a clearly named, evolving outcome-oriented Discovery
Strategy. Strategy adaptation currently occurs through discovery gaps, source
expansion, Market Overview versions, learned terminology, and subsequent cycles. Pass 5
should consolidate those pieces without introducing a planner-agent framework.

### Source inspection and company identity

The discovery persistence model distinguishes:

```text
provider execution
  -> provider source record
  -> zero or more organization references
  -> normalized provider candidates
  -> resolved organization/company
  -> campaign candidate
```

`discovery-source-extraction.ts` can expand directory/list pages into several company
references. `candidate-preclassification.ts` recognizes directory lists, association
member lists, news articles, and content pages as source types. Entity preparation
prevents registry/directory/publisher domains from becoming canonical company domains.
Name/country and name-only identities can remain unresolved instead of receiving an
invented website.

The result repository joins a campaign candidate through `display_organization_id` to
the canonical company and its domains. Invalid and duplicate lanes are explicit.
Existing tests cover directory hosts, multi-company extraction, unsafe website hints,
ambiguous identities, and cross-source deduplication.

Risk: the progressive checkpoint currently treats every non-invalid/non-merged
candidate as resolved. Pass 6 must make the visible-result query and progress counters
prove the stronger invariant: a displayed result has an accepted canonical identity,
not merely a candidate state.

### Cheap validation and expensive qualification

Cheap gates already exist before deep research:

- deterministic source/page classification;
- hard exclusion and excluded-domain checks;
- objective compatibility;
- geography plausibility;
- entity grouping and duplicate/merge handling;
- candidate prioritization using identity, provenance diversity, and campaign fit.

Candidate research then collects bounded evidence. Qualification applies eligibility,
factor evaluation, evidence quality, fit/potential scores, confidence, explanations,
and lanes such as recommended, conditional, needs research, rejected, and excluded.
There is no evidence that qualification thresholds are deliberately lowered to fill a
quantity.

### Adaptive loop and stop conditions

`execute-campaign-v2.ts` owns a maximum of six adaptive cycles. Each cycle runs a
durable set of stages and then calls `decideAdaptiveResearchNextAction`. The controller
currently considers:

- strong unresearched candidates;
- partially expanded source pages;
- actionable discovery gaps;
- consecutive low-yield waves;
- discovery saturation;
- provider calls, tokens, AI cost, deep-research count, and runtime ceilings;
- pause and cancellation.

The prototype target check reads `campaign_runs.metadata.desiredCompanyCount` and
`campaign_runs.companies_qualified`, then stops before starting another cycle. It does
not yet check between qualification fan-out chunks. Qualification currently dispatches
all pending members in one `batchTriggerAndWait`, so additional paid evaluations may be
scheduled after the target could have been met. Candidate research is already divided
into waves of 12, but those waves are budget-aware rather than remaining-outcome-aware.

### Oversampling

The current system generates more than one search result per requested company through
semantic segments, multiple queries, pagination, directory expansion, discovery gaps,
and adaptive cycles. Strategy fields support candidate targets and exploration budget
classes.

There is no single adaptive oversampling policy that derives the required candidate
pool from remaining qualified slots, observed duplicate rate, invalid rate,
qualification yield, source quality, and market complexity. Existing per-segment
targets and fixed wave size are not a complete outcome-based oversampling contract.

### Credits and settlement

The current accounting system separates three important concepts correctly:

- actual provider cost;
- billable provider cost;
- Opptium product credits.

Every paid operation reserves credits and settles actual/billable usage into
`usage_ledger`. Settlement is idempotent and returns unused per-call reservations.
Provider-reported overages are bounded by workspace balance and the Campaign Run credit
cap. Contact Enrichment has a separate authorization table and does not consume Company
Research credits.

The conflicting behavior is at the Campaign Run level:

- `research_credit_cap` is the operational authorization ceiling;
- reservation denial persists `campaign_budget` or `workspace_balance`;
- `authorize_additional_research_credits` increases the same Run cap;
- server actions and recent migrations reopen budget-blocked members;
- existing checkpoint UI was designed around adding more research credits.

Per-operation settlement does not provide final outcome-aware reconciliation. There is
no canonical persisted quote, delivered quantity, completion reason, final charge, or
idempotent Run-level settlement/refund record. The prototype's pure settlement helper
is not connected to persistence and must not be considered implemented.

### Status and completion semantics

Campaign Runs currently use broad execution statuses and phases such as queued,
discovering, evaluating, qualifying, completed, partially completed, cancelled, and
failed. Workflow runs also use `ready_for_review`, `completed_partial`, paused, and
failure states. Discovery decisions persist reasons such as saturation and low yield.

There is no authoritative Run-level completion reason covering all of:

- target reached;
- market exhausted;
- user stopped;
- internal cost guard;
- provider failure with usable partial results;
- genuine unrecoverable technical failure.

User-facing status is consequently inferred from several records and error-message
patterns. Passes 2 and 3 must establish a deterministic persisted terminal contract.

### Progressive UI and diagnostics

Resolved/evaluated candidates and evidence are available progressively. The Company
Research page combines Market Overview, discovery activity, result rows, checkpoints,
run history, and internal usage. The prototype now shows confirmed/requested quantity
in primary controls and removes the obvious additional-credit inputs.

Internal usage currently retains provider calls and raw provider usage, actual and
billable cost, budget state, and Opptium credits. It does not yet derive all requested
outcome economics, particularly cost per qualified company and qualification/duplicate
rates by discovery channel.

## What should be preserved

The following are successful prior-refactor outcomes and should be extended rather than
rewritten:

1. Immutable Company Profile and Campaign Strategy context on each Run.
2. One adaptive Company Research intelligence, not a generic multi-agent framework.
3. Trigger.dev as the durable execution, retry, cancellation, concurrency, and
   checkpoint boundary.
4. Supabase as the authoritative tenant-scoped state and deterministic transition
   boundary.
5. Provider-neutral discovery interfaces, registry, routes, and capability snapshots.
6. Tavily/OpenRouter adapters and current usage metadata.
7. Source records separated from organization references and canonical companies.
8. Multi-company source expansion and retained source provenance.
9. Entity resolution, duplicate/merge review, stable identity hints, and support for
   non-domain identities.
10. Cheap preclassification and prioritization before deep candidate research.
11. Evidence-backed relationship-first qualification and deterministic ranking.
12. Adaptive discovery gaps, source expansion, terminology learning, saturation, and
    marginal-yield behavior.
13. Progressive persistence and partial-result survivability.
14. Provider actual-cost and product-credit separation.
15. Separate Contact Enrichment authorization and workflow.
16. Internal-only provider economics UI.

## Worktree classification

The worktree contained related uncommitted changes before this audit. They must be
reviewed by intent rather than reverted wholesale.

### Keep and integrate

- Market Overview compilation repair and non-blocking bootstrap work.
- Progressive company result loading and checkpoint display.
- Bounded candidate-research waves and durable checkpointing.
- Provider usage/accounting visibility.
- The advisory/audit-role migration if its privilege contract passes database review.
- Candidate budget-block persistence where it remains useful for an internal safety
  stop rather than a user-managed normal pause.

### Revise in later passes

- Quantity and quote prototype in `CampaignBriefForm`, `CampaignControls`, and
  `outcome-pricing.ts`: retain the direction, replace it with the canonical Pass 2
  contract.
- Adaptive `stop_target_reached`: retain the decision, move target checks to every paid
  scheduling boundary and use authoritative cumulative counts.
- Checkpoint status derivation: replace error-message inference with persisted terminal
  reasons.
- September authorization-repair and budget-reopen migrations: reconcile with the new
  internal-guard model before applying them as final product behavior.
- `continueV2CampaignResearchAction`: change from adding credits to increasing an
  outcome target or broadening scope.

### Remove after replacement exists

- user-entered additional Company Research credit authorization;
- ordinary `campaign_budget` completion/pause copy;
- credit-cap-driven continuation as the primary product workflow;
- duplicate target sources of truth;
- the unconnected prototype outcome-settlement helper if Pass 2 replaces its contract.

Historical usage rows, actual provider costs, and audit records must not be deleted.

## Acceptance-criteria ownership matrix

| Requirement                                | Current state                                          | Owning implementation pass/layer | Required proof                        |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------- | ------------------------------------- |
| User selects quantity                      | Prototype present                                      | Pass 2 domain; Pass 8 UI         | UI and action tests                   |
| Quantity is canonical objective            | Partial in campaign/Run metadata                       | Passes 2–4                       | domain, repository, workflow tests    |
| Centralized quote                          | Prototype pure function                                | Pass 2                           | pricing tests                         |
| Quote is maximum authorization             | Per-call behavior only                                 | Pass 3 DB/accounting             | migration and settlement tests        |
| Stop at requested qualified count          | End-of-cycle prototype                                 | Pass 4 Trigger/workflow          | no-next-call and wave tests           |
| Rejected/duplicate/unresolved do not count | Mostly represented by lanes/states                     | Passes 4 and 6                   | counter and result-query tests        |
| Market exhaustion below target             | Discovery signals exist                                | Pass 7 terminal contract         | 17/25 workflow test                   |
| Do not weaken qualification                | Current thresholds appear independent                  | Pass 6 qualification             | threshold regression test             |
| Visible result is resolved company         | Strong model, query proof incomplete                   | Pass 6 repository/UI             | entity-integrity integration tests    |
| Multi-company source extraction            | Implemented                                            | Preserve in Pass 5/6             | existing plus provider contract tests |
| Company without website can qualify        | Identity model supports it                             | Pass 6                           | end-to-end fixture                    |
| Provider/channel strategy                  | Provider-neutral foundation exists                     | Pass 5                           | routing and fallback tests            |
| Adapt discovery strategy                   | Distributed across gaps/overview/cycles                | Pass 5                           | persisted strategy-revision test      |
| Adaptive oversampling                      | Partial, not outcome-derived                           | Pass 5                           | yield/duplicate-rate tests            |
| Cheap validation before deep work          | Implemented foundation                                 | Pass 6                           | no-expensive-call tests               |
| Internal economic guard                    | Implemented as budgets/ceilings                        | Passes 3–4                       | runaway and partial-result tests      |
| Fair partial settlement                    | Not implemented at Run level                           | Pass 3                           | atomic idempotent settlement tests    |
| Progressive results                        | Implemented foundation                                 | Preserve; Pass 8 presentation    | progressive query/UI tests            |
| Target/partial/stopped states              | Inferred and fragmented                                | Passes 2, 3, 7                   | state-transition tests                |
| Same-run target increase                   | Credit continuation exists, target continuation absent | Pass 7                           | resume/no-repeat tests                |
| Provider economics retained                | Implemented                                            | Preserve; Pass 8 derive outcomes | internal usage tests                  |
| Channel yield metrics                      | Provenance exists; aggregate incomplete                | Pass 8 read model                | channel aggregation tests             |
| Contact Enrichment separate                | Implemented                                            | Preserve                         | existing boundary tests               |
| Remove competing credit UX/runtime         | Partial UI cleanup only                                | Pass 9                           | repository-wide contract search       |

## Pass 2 decisions

Pass 2 made and documented these deterministic choices:

1. Use one canonical name (`requestedCompanyCount`) throughout TypeScript and persisted
   contracts while retaining `target_volume` only as the existing database column until
   a migration deliberately changes it.
2. Strategy coverage remains a separate internal candidate-pool objective and cannot
   override the requested qualified-company count.
3. `recommended` and `conditional` count as delivered because both have passed the
   existing qualification gates. Conditional limitations remain explicit. Counts are
   unique by canonical company ID.
4. Outcome settlement V1 charges no more than accrued work or the quote. System-ended
   partial outcomes use a 20% fixed-work floor plus 80% delivered-ratio value ceiling;
   user stops pay accrued work up to the quote; genuine technical failure is not charged.
5. Target increases must operate on the same Run with audit history. The exact append-only
   database representation remains a Pass 3 schema decision.
6. The shared terminal vocabulary is `target_reached`, `market_exhausted`,
   `user_stopped`, `internal_cost_guard`, `provider_failure`, and `technical_failure`.

## Pass 1 conclusion

No wholesale engine replacement is justified. Passes 2–9 should convert the control
contract around the existing V2 research engine. The highest-risk boundaries are
Run-level settlement, target-aware qualification fan-out, authoritative completion
state, and same-Run continuation. Entity resolution, source extraction, provider
abstraction, adaptive discovery, usage accounting, and progressive persistence are
substantial working assets that should remain intact.

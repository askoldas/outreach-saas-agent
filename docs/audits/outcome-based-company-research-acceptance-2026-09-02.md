# Outcome-Based Company Research — Final Acceptance

The nine implementation passes are complete on `research_improvement`. The refactor
keeps the existing V2 adaptive engine and changes its product contract from an
open-ended research-credit budget to delivery of up to a requested number of genuinely
qualified companies.

## Accepted invariants

| Area             | Accepted behavior                                                                                        | Primary proof                             |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Campaign input   | User selects 25, 50, 100, or a bounded custom company quantity                                           | pricing and campaign UI contracts         |
| Pricing          | A centralized, versioned quote is the maximum authorization                                              | outcome pricing and migration contracts   |
| Objective        | Authoritative unique Recommended and Conditional companies count toward the target                       | outcome progress and settlement contracts |
| Stopping         | Paid scheduling checks the target; reaching it prevents further provider work                            | Trigger boundary contracts                |
| Partial outcomes | Exhaustion, provider degradation, and internal guards preserve usable results                            | terminal settlement contracts             |
| Entity integrity | Visible results originate from resolved campaign companies, never raw source records                     | progressive result contracts              |
| Discovery        | Provider-neutral strategies, adaptive oversampling, source expansion, and cheap validation remain intact | discovery/controller contracts            |
| Continuation     | A larger target reopens the same Run and reuses persisted work                                           | target-increase migration contract        |
| Economics        | Provider accounting remains immutable; outcome settlement appends reconciliation                         | usage and settlement contracts            |
| Attribution      | Internal read models expose deduplicated provider/source-type yield                                      | outcome economics tests                   |
| Product controls | No ordinary resume path purchases an arbitrary research-credit increment                                 | outcome-control cleanup contract          |
| Boundary         | Contact Enrichment retains separate authorization and accounting                                         | contact enrichment contracts              |

## Deliberately retained internals

Research reservations, provider usage, product-credit conversion, workspace balance,
and hard execution ceilings remain internal economic safeguards. Historical migrations
and ledger records remain append-only. Manual pause/resume remains a workflow control;
it does not change the outcome quote.

## Deferred by product decision

New paid discovery providers, source-level cost allocation for shared provider calls,
production billing, and automated channel recommendations remain deferred. The current
provenance model is sufficient to add those capabilities without replacing Company
Research.

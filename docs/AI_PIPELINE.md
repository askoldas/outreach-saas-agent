# Research and AI Pipeline

## Canonical flow

```text
official website
  -> Company Intelligence V3 evidence and review
  -> published normalized commercial graph
  -> native Campaign Strategy V2
  -> semantic discovery
  -> entity resolution
  -> candidate research
  -> relationship-first qualification
  -> comparative ranking
  -> user review
  -> optional contact enrichment
  -> grounded outreach drafts
```

Company Intelligence uses bounded first-party website evidence and six versioned,
schema-validated stages. Re-analysis creates a new review draft; publishing creates an
immutable V3 version.

Campaign planning receives the published V3 graph and selected geography. It proposes a
structured brief for user confirmation. The native deterministic compiler then creates
the V2 strategy and provider-neutral discovery plan.

Discovery stores raw provider provenance and normalized candidate hints without
assigning final fit. Entity resolution creates stable organization identities.
Candidate research collects question-driven evidence and explicit unknowns.
Before Candidate Research, a deterministic, versioned viability score orders the resolved
pool using cheap identity, source-diversity, archetype-fit, reusable-intelligence, and
conflict signals. The score and its contributions are frozen in the research source plan;
it prioritizes expensive work but never acts as final qualification. Research executes in
bounded waves of 12 against one unchanged Candidate Research quality contract. Wave size
is an internal concurrency control, not a user-visible target or quality tier.
Useful association, exhibitor, registry-style, and industry-directory pages remain
discovery sources rather than target companies. Their referenced organizations are
expanded in bounded, resumable chunks and enter the same normalized-candidate and Entity
Resolution path with immutable source/query/extraction provenance. Explicit company links
may provide domain hints; name-only references remain unresolved rather than borrowing the
directory domain.
For multi-country markets, discovery runs country-specific and local-language queries.
Provider country targeting improves retrieval but is never accepted as geographic
evidence. Research resolves a frozen target-geography question from first-party,
registry, official-document, or trusted-directory evidence before qualification can
pass the candidate's geographic eligibility gate.
Its persisted findings retain semantic `claimKeys` alongside durable `claimIds`;
Qualification accepts both and uses the durable identifiers for scoring.
Qualification applies evidence gates and relationship-first factors. Comparative
ranking is deterministic and keeps fit, commercial potential, confidence, lane, and
rank separate.

When a later Campaign Run encounters the same public source, the new run retains a
duplicate-provenance link and persists its own normalized candidate reference. A
cross-run duplicate must not disappear from the current run's frozen discovery set.

## AI boundary

AI may extract facts, synthesize commercial structures, propose a campaign brief,
structure candidate evidence, support qualification, and generate grounded drafts.
It cannot authorize a workspace, mutate arbitrary fields, select a workflow version,
override a kill switch, determine final persistence scope, or send outreach.

All structured output is parsed and schema validated. Every paid request records its
logical role, prompt/schema version, selected and actual model, fallback state, request
hash, latency, token usage, and provider-reported cost when available.

## Paid model routing

OpenRouter is the gateway. Required runtime configuration is `OPENROUTER_API_KEY`;
model, fallback, and timeout variables are optional overrides because versioned paid
defaults exist in application code.

High-impact roles may use the controlled paid fallback for retryable transport,
timeout, rate-limit, provider-availability, or model-availability failures. A valid but
undesirable business result does not trigger a second model. Free models and moving
`latest`/`auto` aliases are rejected.

## Historical boundary

The V1 profile analyzer, flat Strategy generator, search-result classification prompt,
sequential lead evaluator, Campaign Agent loop, and adapter-seeded V2 constructors are
retired. Their immutable database outputs remain readable for historical reports and
exports, but no live code can create or execute new V1 work.

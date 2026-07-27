# Research and AI Pipeline

## Clean-baseline model direction

The clean database provides `ai_model_configs`, `ai_requests`,
`provider_executions`, idempotency, and cost records. The application now resolves
explicit logical roles through the paid-model registry below. Vercel AI SDK remains a
later transport change; existing prompts, versions, parsers, and schemas are preserved.

Company Profile analysis (`company-profile-website-v3-grouped`) first records atomic website facts with source, confidence, origin, page title, passage, and extraction time. It classifies commercial items before grouping them into campaign-worthy offerings; product categories, features, supporting services, capabilities, business models, and relationship models are not promoted to standalone offerings automatically. Deterministic validation then normalises proof and produces at most seven review decisions driven by real commercial ambiguity. Re-analysis creates a new draft version and preserves user-confirmed strategy fields and approved communication rules.

The profile keeps customer types, buyer industries, needs, relationship types, current and potential markets separate. It also separates differentiators, verified claims, strategic direction, commercial constraints, regulatory limitations, and conflicting information. Readiness measures practical prospecting capability rather than extracted-fact or unanswered-question volume; only blocking questions prevent publication.

Profile review questions use explicit stages and durable answered, skipped, or dismissed states. Successful analysis normally produces only an optional grouped-offering review. A blocking profile question is reserved for the absence of any usable offering or a critical identity/structure conflict. Campaign targeting decisions use a separate readiness object and do not reduce Company Profile readiness.

The target pipeline is Company Profile extraction → structured Campaign Strategy → discovery → identity normalization/deduplication → company research → qualification → basic public contact discovery → stable lead review → approved-company enrichment → recipient recommendation → draft generation → CSV export.

Trigger.dev executes Company Profile analysis, Campaign discovery and qualification,
approved-company contact enrichment, and grounded draft generation from durable
`provider_executions` records. Discovery and qualification use the immutable profile
snapshot and Strategy version frozen on the Campaign Run, persist canonical companies
and sources, and preserve failed AI evaluations for manual review. The former polling
runtime has been retired. Provider failures remain visible and must not corrupt
authorization or workflow state.

AI may interpret seller/source material, propose strategies, extract facts, assess qualification dimensions, and compose grounded text. Deterministic code validates schemas, owns state transitions, freezes used strategy versions, applies exclusions, recommends contacts using declared priority, calculates credit estimates, and prevents unapproved spending or sending.

Every prospect fact needs provenance or an explicit inference label. Fit excludes contactability and evidence quality. Drafts may use only Company Profile claims, the strategy version used, stored prospect evidence, and the selected recipient context.

Current clean behavior includes immutable strategy versions linked to Campaign Runs,
provider-backed contact enrichment with verification provenance, evidence-backed
qualification, campaign-scoped review, deterministic recipient recommendations,
schema-validated Company Profile and Strategy generation, Trigger.dev grounded draft
generation, immutable usage-ledger entries, persisted export history, authorized
historical CSV downloads, live progress, database integration coverage, and
browser-level workflow coverage. CSV bytes are generated locally from frozen records.
Deep crawling and paid enrichment vendors remain excluded.

Before adaptive planning, `src/lib/campaign-agent/execution-policy.ts` enforces the
approved discovery ceilings. These limits are owned by deterministic code rather than
model output. Deterministic discovery may perform up to five bounded iterations while
preserving the same query, result, and company ceilings. Later iterations change source
family, persist their own plan path and execution identity, and exclude domains already
seen by the Campaign Run before deep evaluation.

The Campaign Agent loop accepts an injected planner plus typed discovery/evaluation
tools. This keeps OpenRouter and any future Vercel AI SDK transport outside the
workflow state machine. The loop can stop as complete, request a user-input gate, or
refine within hard limits. Its first adapter uses the logical `campaign_planning`
route, JSON mode, a versioned prompt, and strict plan parsing. Stable states can be
persisted and resumed as Campaign Run checkpoints. It remains outside the live
Campaign execution path while `CAMPAIGN_AGENT_ENABLED` is false. The guarded path now
passes the validated plan into the real Tavily discovery and OpenRouter qualification
child, then evaluates returned counts deterministically. It deliberately completes
or refines from cumulative persisted company counts. Each iteration has an isolated
provider execution and usage record, and retries resolve the same
parent-plus-iteration identity rather than creating another paid execution.
Each validated planner result is audited before its discovery child starts. The audit
retains model routing and usage provenance without making model conversation state
authoritative. Orchestration failures close pending execution records and remain
visible on the Campaign Run.
Planner context is a compact projection of the frozen campaign, selected offering,
seller identity, and Strategy rather than an unbounded raw profile. Plans must search
for counterparties—not the seller—and every query combines geography, a target signal,
and a business-discovery intent. Refinement receives prior queries and observations to
avoid repeating the same search.

Guided natural-language interpretation uses the separate `guided-change-v1` prompt. It
receives only the current Company or Campaign context, an explicit field allowlist,
allowed operations, and the response contract. Output is validated before display and
again before application. Ambiguous requests must return a clarification question rather
than a mutation. Application code—not the model—owns field mapping, stale-version checks,
new version creation, and audit persistence.

## Paid model routing

OpenRouter remains the default gateway. Application code requests a logical role from
`src/lib/ai/model-router.ts`; raw model IDs live only in the central registry and
environment overrides.

| Logical role                   | Initial primary model         | Controlled fallback | Current call site                          |
| ------------------------------ | ----------------------------- | ------------------- | ------------------------------------------ |
| `campaign_planning`            | `anthropic/claude-sonnet-4.6` | `openai/gpt-5-mini` | Campaign Strategy generation               |
| `profile_analysis`             | `anthropic/claude-sonnet-4.6` | `openai/gpt-5-mini` | Company Profile website analysis           |
| `company_qualification`        | `anthropic/claude-sonnet-4.6` | `openai/gpt-5-mini` | Lead/company qualification                 |
| `outreach_generation`          | `anthropic/claude-sonnet-4.6` | `openai/gpt-5-mini` | Grounded outreach draft generation         |
| `campaign_reflection`          | `anthropic/claude-sonnet-4.6` | `openai/gpt-5-mini` | Reserved for campaign final evaluation     |
| `website_extraction`           | `openai/gpt-5-mini`           | none                | Reserved for AI website structuring        |
| `search_result_classification` | `openai/gpt-5-mini`           | none                | Candidate classification before evaluation |
| `guided_interpretation`        | `openai/gpt-5-mini`           | none                | Bounded guided commercial changes          |
| `low_risk_transformation`      | `openai/gpt-5-mini`           | none                | Reserved for low-risk structured rewriting |

Sonnet is initially reserved for decisions where weak reasoning can create false
qualification, unnecessary enrichment spend, unsupported claims, or poor strategy.
GPT-5 Mini is the initial economical choice for bounded extraction and transformation.
These defaults are not permanently optimal; they require Opptium-specific benchmarking.
Gemini 2.5 Flash remains a possible benchmark, not a third production default.

Fallback is enabled only for high-impact roles and only for retryable transport,
timeout, rate-limit, provider-availability, or model-availability failures handled by
OpenRouter. A valid but undesirable business result never triggers a second model.
Free models and moving `latest`/`auto` aliases are rejected.

The provider boundary records requested and actual model, fallback status/reason,
request ID, latency, token usage, and provider-reported USD cost when OpenRouter
returns them. Structured output still passes through the existing application parser.
Provider cost remains separate from product credits. The versioned pricing boundary is
intentionally empty until prices are verified; no currency conversion is performed.

Configure model IDs per environment with the variables in `.env.example`. Run
`corepack pnpm test` for routing and regression checks. Fixtures in
`tests/fixtures/ai` are synthetic and no unit test makes a paid model call.

## Staged campaign workflow

Campaign creation is geography-first:

```text
geography -> AI-proposed Offering and target client -> user confirmation
-> requested qualified-company quantity -> Start campaign
```

`campaign_planning` produces both the Campaign Brief proposal and the versioned compact
Market Analysis/Discovery Plan. Market analysis determines where and how to search;
discovery stores raw candidates; classification cheaply removes obvious bad candidates;
evaluation deeply judges commercial fit with evidence. Deterministic source and domain
rules remove obvious non-company results and duplicates. Remaining plausible candidates
are classified in one economical `search_result_classification` batch per iteration.
Only `promising` and policy-approved `possible` candidates enter
`company_qualification`.

Preferred outreach language is supplied only to draft and sequence generation.
Discovery and qualification receive the Strategy's discovery-language list, derived
from target countries plus English for international sources. Selecting English for
outreach therefore does not suppress Lithuanian, Latvian, Estonian, or other relevant
local-language discovery.

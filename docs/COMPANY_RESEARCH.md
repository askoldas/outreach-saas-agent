# Company Research

The active campaign flow is Campaign Setup -> Company Research -> Contact Enrichment.
Company Research is one resumable adaptive process. Its structured state combines the
current Market Overview, explored and pending search directions, processed source
fingerprints, canonical companies, evidence, evaluation state, saturation signals, and
budget state. It does not persist private model reasoning.

New runs have no standalone `market_analysis` workflow stage. Initialization does not
wait for an LLM overview: it dispatches retry-safe market-context enrichment in the
background while discovery freezes its plan from the confirmed Strategy (or enriches
it from a run-tied Market Research Plan if that artifact is already ready). Provider
work remains under the same research credit boundary. Later cycles evolve the Market
Overview from observed evidence.

Search results are sources, never company results. Source inspection may extract zero,
one, or many organization references. Entity resolution validates and merges those
references before progressive company persistence; an official domain is preferred but
is not required when reliable legal-name, registry, and location evidence establishes a
real company. Multiple sources remain attached as provenance.

Trigger.dev provides durable execution, retries, bounded fan-out, checkpoints, pause,
cancel, and continuation. Supabase owns deterministic state transitions, idempotency,
entity merges, and credit reservations. The primary objective is the requested
qualified-company quantity. Research stops when that outcome is reached, or earlier
when market routes are exhausted without weakening qualification. Provider-call,
runtime, deep-research, token, and cost ceilings remain internal safety guards.
Continuation reuses persisted source/query fingerprints and company identities.

Campaign setup offers configured 25, 50, and 100-company choices plus a bounded custom
quantity. Centralized outcome pricing derives a maximum Opptium-credit authorization
from quantity and lightweight discovery complexity. The UI reports confirmed companies
against the requested quantity; provider units remain internal diagnostics.

The quoted price is a maximum authorization rather than a request to consume credits.
Every paid operation reserves a conservative product-credit estimate before the call.
Settlement records raw provider units, actual USD cost, billable USD cost, and Opptium
credits, then releases unused reservation. Technical retry spend can increase actual
cost without duplicating billable usage because settlement is idempotent. Product-credit
conversion is provider-independent and configured by `OPPTIUM_COST_PER_CREDIT_USD`.
Tavily's provider-unit conversion is configured separately with
`TAVILY_PROVIDER_CREDIT_COST_USD`; it never defines the customer-facing credit value.

The canonical outcome contract counts unique resolved companies in the Recommended or
Conditional qualification lanes. Conditional companies remain visibly conditional;
needs-research, rejected, excluded, invalid, duplicate, and unresolved candidates never
count. Terminal reasons distinguish target reached, market exhaustion, user stop,
internal cost guard, provider failure, and genuine technical failure. Outcome
settlement policy is versioned independently from provider accounting; its transactional
database application is provided by migration `20260902000400`. Campaign Runs persist
the requested quantity, immutable quote, delivered quantity, outcome state, terminal
reason, final settlement, and settlement time. Finalization serializes against provider
reservations, releases unfinished reservations, reconciles any outcome refund to the
workspace account, and appends an adjustment without deleting provider-cost history.
The settlement RPC is service-role only and retry-idempotent.
Until checkout is implemented, migration `20260827000100` centrally grants existing and
new MVP workspaces 120 development credits; replace that grant when account funding is
connected.

The follow-up migrations `20260827000200` through `20260827000600` add failed-call
reservation release, evolving Market Overview versions, same-run credit authorization,
durable budget-pause reasons, and safe settlement of provider-reported overages. Apply
them in timestamp order after `20260827000100`.

Migration `20260902000400_outcome_based_research_contract.sql` follows the September
checkpoint repairs. It also adds tenant-readable, append-only target-revision records
for the later same-Run quantity-increase workflow. New Run startup authorizes the
validated versioned outcome quote through a service-role RPC before Trigger dispatch.
Migrations `20260902000500` through `20260902000700` make outcome progress and
settlement counts authoritative and implement retry-idempotent target increases on the
same Run. A completed campaign cannot start a replacement research Run; additional
results require a larger quantity target and preserve prior candidates, evidence,
source fingerprints, and settlement history.

Internal observability derives cost per qualified company, qualification and duplicate
rates, and provider/source-type yield from existing immutable provenance. Companies are
deduplicated within each channel. Provider costs remain Run-level when a shared call
cannot be attributed safely to one source; the read model does not invent allocations.

Contact Enrichment is a separate downstream credit scope. Migration `20260827000700`
adds per-company maximum authorization, reservation, settlement, and failure release.
Its Tavily usage is recorded as `contact_enrichment` and never increments a Campaign
Run's `research_credits_consumed` value.

Set `NEXT_PUBLIC_OPPTIUM_INTERNAL_USAGE=true` only in trusted development/internal
deployments to show provider calls, tokens/units, actual cost, billable cost, and budget
details on the Company Research page. No provider credentials are selected or rendered.

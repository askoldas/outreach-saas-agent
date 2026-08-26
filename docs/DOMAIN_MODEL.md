# Domain Model

## Clean-baseline transition

The clean target model replaces the legacy campaign-bound `Lead` persistence with:

```text
Company -> Campaign Company -> Qualification
Company -> Contact -> Contact Method
Campaign Company -> Campaign Contact -> Outreach Draft
Campaign -> Campaign Run -> Events / Questions / Approvals
```

Current TypeScript `Lead` and `ContactRoute` read models remain temporary compatibility
contracts until Phase 2. The canonical clean database model is documented in
`docs/database/clean-baseline-design.md`.

- `Workspace`: tenant, membership, settings, and authorization boundary.
- `CompanyProfile`: stable workspace-owned identity for structured seller knowledge.
- `CompanyProfileVersion`: immutable numbered seller-knowledge version and provenance.
- `Offering`: a separately targetable commercial product, service, or partnership model with its own ICP, buyer personas, markets, qualification rules, constraints, capabilities, and proof.
- `CommercialItem`: extracted website material classified as an offering, product category, capability, supporting service, business model, relationship model, feature, or irrelevant before grouping.
- `CustomerLandscape`: reusable company-level customer types, buyer industries, needs, relationship types, existing markets, and potential markets.
- `Differentiator` and `ProofPoint`: distinct commercial differentiation and categorised evidence; metrics, certifications, facilities, operational evidence, references, cases, testimonials, results, and investments retain their correct categories.
- `Capability`: operational competence that may support several Offerings but is not automatically sold independently.
- `ProfileFact` and `SourceReference`: atomic extracted evidence retained behind the visible profile for conflict, confidence, and claim review.
- `ReviewQuestion`: one commercially meaningful decision required to make discovery, qualification, buyer selection, or messaging safe.
- `CampaignProfileSnapshot`: immutable copy of the exact profile version selected when a campaign is created.
- `Campaign`: natural-language objective, focus, geography, status, strategy reference,
  and bounded research-cycle state. Historical desired-count fields are compatibility
  projections and do not control native V2 execution.
- `CampaignBrief`: confirmed geography, campaign-only Offering wording, structured
  target client, qualification requirements, and exclusions. The original validated AI
  proposal remains separate from the user-confirmed brief. A saved Campaign Strategy
  revision synchronizes the confirmed market and target-client fields for future runs
  without changing the original proposal or Company Profile.
- `MarketAnalysis`: versioned run artifact for market breadth, local terminology,
  sources, signals, exclusions, data challenges, and search approach.
- `DiscoveryPlan`, `DiscoveryPath`, and `DiscoveryIteration`: bounded, auditable search
  intent, queries, provenance, counters, yield, and continuation decision.
- `DiscoveryCandidate`: lightweight raw search candidate saved before qualification.
- `DiscoverySourceExpansion`: retry-safe expansion state for a useful directory or list
  source, including its extraction version and continuation offset.
- `DiscoverySourceOrganizationReference`: an organization named by a discovery source,
  retaining provider execution, source URL, query/source family, extraction method, and
  stable reference identity before Entity Resolution.
- `CandidateClassification`: cheap deterministic or economical-model decision gating
  whether a raw candidate may receive deep evidence-aware evaluation.
- `CandidatePrioritization`: versioned, explainable cheap-stage signals used only to order
  resolved organizations for Candidate Research. It is persisted with the frozen source
  plan and is not a qualification result.
- `CandidateResearchWave`: a bounded ordered slice of research members. Every member uses
  the same Candidate Research contract; wave boundaries control concurrency and enable
  later adaptive yield decisions without creating lower-quality research modes.
- `CampaignAgentCheckpoint`: retry-safe workspace-scoped snapshot of one Campaign Agent
  loop state at a deterministic phase boundary; it is operational state, not model
  conversation memory.
- `ProviderExecution`: one auditable paid-work boundary. Campaign Agent iteration
  executions reference their orchestration parent and carry a bounded iteration number.
- `StrategyVersion`: persisted immutable targeting, relevance, qualification, contact-role, and research plan. Editable predecessors become superseded; a research run references and freezes the exact used version.
- `Lead`: a candidate company scoped to one campaign.
- `Qualification`: Fit Score, label, confidence, dimensions, explanation, and evidence. Contactability is separate.
- `EvidenceClaim`: fact, inference, unknown, or conflict linked to a source.
- `Contact`: public business route or professional identity with provenance and verification state.
- `RecipientRecommendation`: exactly one primary recipient plus fallback routes.
- `OutreachDraft`: editable generated content grounded in frozen seller/strategy versions, lead evidence, and an accepted recipient; never a sent message.
- `Export`: Outreach CSV or Lead Research CSV metadata and rows.
- `UsageEvent`: immutable operation-level estimate and actual credit consumption.
- `Activity`: important state or user action.

All tenant-owned persisted records trace to a Workspace. Application code controls transitions. Evidence-backed prospect facts and seller claims remain separate from inferences. Profiles, versions, campaign snapshots, exports, and usage events are persisted.

Company Profile v2 stores its explicit domain model as validated structured JSON on each immutable version. Legacy string-array columns are a temporary compatibility projection for current campaign workers, not the source of truth. Website analysis preserves user-owned prospecting preferences when producing a newer draft. Publishing freezes the reviewed version; campaigns may select one Offering and hold campaign-specific overrides without changing the master profile.

- `AiGuidedDraft`: discardable progress and structured selections for one scoped setup.
- `AiConversation` and `AiMessage`: contextual assistant history, stored separately from business objects.
- `AiAppliedChange`: auditable confirmed proposal with previous/applied values, actor, source, base version, and undo metadata.
- `MessagingBrief` and `SequenceStrategy`: typed foundations for later guided outreach setup; persistence and full workflows remain deferred.

Recipient recommendations are deterministic read models derived from persisted approved leads and contact routes; accepted or overridden selection state is persisted per lead. Draft generation tasks freeze profile and strategy identifiers, preserve AI prompt/output provenance, and idempotently replace the primary campaign-lead variant for review. Drafts, enrichment lifecycle, frozen export records, and usage events are persisted. CSV download bytes are generated locally from the frozen authorized data.

# Company Profile, Offering, and Campaign Target boundaries

The Company Profile stores stable business knowledge, including capabilities, existing
offerings, factual current customer groups, evidence, constraints, and plausible B2B
applications. Consumer audiences are valid profile facts.

An Offering describes what the company can sell and why an organization would buy it.
It separates buyer organization types, decision-maker roles, and beneficiaries or end
users. Offerings may be confirmed, inferred, proposed, or rejected. Inferred and newly
packaged B2B Offerings require user confirmation.

A Campaign owns its market, one primary Offering, optional supporting capabilities, and
one or more distinct Target Segments. Each Target Segment has a B2B relationship type,
organization types, industries, observable characteristics, buying signals, likely
buyer roles, exclusions, rationale, evidence, confidence, and discoverability.

Campaign markets and Target Segments are not written back into the Company Profile.
Current customer groups are not promoted into Campaign targets automatically.

Confirmed Company Profiles and Campaign Strategies are immutable versions. Website
facts, user confirmations, AI inference, AI proposals, rejections, and restorations
retain provenance in the structured version and applied-change audit.

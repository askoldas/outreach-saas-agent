# Domain Model

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
- `Campaign`: natural-language objective, focus, geography, desired count, status, and strategy reference.
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

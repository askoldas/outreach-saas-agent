# Domain Model

- `Workspace`: tenant, membership, settings, and authorization boundary.
- `CompanyProfile`: stable workspace-owned identity for reusable seller knowledge.
- `CompanyProfileVersion`: immutable numbered seller-knowledge version and provenance.
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

Recipient recommendations are deterministic read models derived from persisted approved leads and contact routes; accepted or overridden selection state is persisted per lead. Draft generation tasks freeze profile and strategy identifiers, preserve AI prompt/output provenance, and idempotently replace the primary campaign-lead variant for review. Drafts, enrichment lifecycle, frozen export records, and usage events are persisted. CSV download bytes are generated locally from the frozen authorized data.

# Domain Model

## 1. Purpose

This document defines the initial shared language and data boundaries for the product. It is a conceptual model, not a final SQL schema.

Implementation should preserve these meanings while allowing the exact columns and indexes to evolve through migrations.

## 2. Core relationship map

```text
User
  └─ WorkspaceMembership ── Workspace
                               ├─ Offer
                               │   └─ OfferVersion
                               ├─ Campaign
                               │   ├─ CampaignStrategyVersion
                               │   ├─ ResearchRun
                               │   └─ Lead
                               │       ├─ LeadSource
                               │       ├─ EvidenceClaim
                               │       ├─ Qualification
                               │       ├─ Contact
                               │       ├─ OutreachDraft
                               │       └─ Activity
                               └─ SuppressionEntry (later required before sending)
```

A normalized public company identity may later be represented separately from a workspace campaign lead. The MVP should avoid cross-tenant data sharing until that behavior is explicitly approved.

## 3. Shared conventions

All tenant-owned entities should include:

- stable unique ID;
- workspace ownership, directly or through an immutable parent;
- `created_at` and `updated_at` in UTC;
- creator or actor where relevant;
- explicit status where lifecycle exists;
- optional metadata only for non-contractual extensions, not as a substitute for modeled fields.

Use lowercase machine values for statuses and enums. User-facing labels belong in the application localization layer.

## 4. Identity and tenancy

### User

Represents an authenticated person. Authentication data may be managed by Supabase Auth while application profile data remains in an application table when needed.

Typical fields:

- `id`
- `display_name`
- `locale`
- `created_at`
- `updated_at`

### Workspace

The tenant and primary data boundary.

Typical fields:

- `id`
- `name`
- `slug`
- `website_url`
- `default_locale`
- `operating_countries`
- `status`
- `created_by`
- timestamps

Initial statuses:

- `active`
- `suspended`
- `closed`

### WorkspaceMembership

Connects users to workspaces.

Typical fields:

- `workspace_id`
- `user_id`
- `role`
- `status`
- `invited_by`
- timestamps

Initial roles:

- `owner`
- `admin`
- `member`
- `viewer`

Role permissions should be encoded in server-side policy functions or services, not scattered conditional checks.

## 5. Seller knowledge

### Offer

A stable reusable product or service concept owned by a workspace.

Typical fields:

- `id`
- `workspace_id`
- `name`
- `offer_type`
- `status`
- `current_approved_version_id`
- timestamps

Possible `offer_type` values:

- `product`
- `service`
- `software`
- `distribution`
- `manufacturing`
- `partnership`
- `other`

Do not treat this list as sector classification. It only helps shape onboarding and presentation.

Offer statuses:

- `draft`
- `active`
- `archived`

### OfferVersion

An immutable snapshot of normalized seller information.

Typical fields:

- `id`
- `offer_id`
- `workspace_id`
- `version_number`
- `source_input`
- `summary`
- `problems_solved`
- `capabilities`
- `customer_value`
- `use_cases`
- `likely_buyer_types`
- `differentiators`
- `approved_claims`
- `limitations`
- `keywords`
- `language`
- `review_status`
- `created_by`
- `approved_by`
- `approved_at`
- timestamps

Review statuses:

- `generated`
- `needs_review`
- `approved`
- `rejected`
- `superseded`

Only approved offer versions may provide seller claims for final outreach drafts.

## 6. Campaign

### Campaign

A user-owned objective to find prospects for one offer in a defined market.

Typical fields:

- `id`
- `workspace_id`
- `offer_id`
- `name`
- `objective`
- `target_geographies`
- `target_languages`
- `desired_lead_count`
- `status`
- `current_strategy_version_id`
- timestamps

Initial objective values:

- `direct_buyers`
- `distributors`
- `resellers`
- `partners`
- `subcontracting_clients`
- `other`

Campaign statuses:

- `draft`
- `planning`
- `ready`
- `running`
- `paused`
- `completed`
- `archived`

A campaign references an offer, but each research run must freeze the exact approved offer version used.

### CampaignStrategyVersion

An immutable campaign strategy snapshot.

Typical fields:

- `id`
- `campaign_id`
- `workspace_id`
- `version_number`
- `offer_version_id`
- `target_segments`
- `company_type_criteria`
- `industry_criteria`
- `size_criteria`
- `search_terms`
- `localized_search_terms`
- `source_categories`
- `qualification_criteria`
- `exclusion_criteria`
- `expected_limitations`
- `review_status`
- timestamps and actors

The user should approve or explicitly start a strategy version before research begins.

## 7. Workflow execution

### ResearchRun

A durable execution instance for a campaign and strategy version.

Typical fields:

- `id`
- `workspace_id`
- `campaign_id`
- `strategy_version_id`
- `offer_version_id`
- `status`
- `requested_lead_count`
- `discovered_count`
- `reviewable_count`
- `failed_task_count`
- `started_at`
- `completed_at`
- `cancelled_at`
- `failure_category`
- `failure_summary`
- `usage_summary`
- timestamps

Statuses:

- `queued`
- `running`
- `partially_completed`
- `completed`
- `failed`
- `cancel_requested`
- `cancelled`

### ResearchTask

A persisted bounded unit of work inside a run.

Typical fields:

- `id`
- `research_run_id`
- `workspace_id`
- `task_type`
- `idempotency_key`
- `status`
- `input_reference`
- `attempt_count`
- `available_at`
- `started_at`
- `completed_at`
- `last_error_category`
- `last_error_summary`
- timestamps

Task statuses:

- `pending`
- `running`
- `succeeded`
- `retry_scheduled`
- `failed`
- `cancelled`
- `skipped`

The actual durable-job platform may keep its own execution records, but application-level checkpoints remain in the product database.

Current implementation note:

- `search_web` generates campaign/offer-aware queries, saves `lead_sources`, and
  enqueues lead evaluation tasks;
- `evaluate_lead` calls OpenRouter with a versioned prompt, validates strict
  JSON, logs `ai_generations`, and creates or updates leads for qualified or
  needs-review candidates;
- disqualified candidates may remain only as sources and AI generation logs.

## 8. Lead and company identity

### Lead

A candidate company within one campaign.

Typical fields:

- `id`
- `workspace_id`
- `campaign_id`
- `research_run_id_first_seen`
- `company_name`
- `legal_name`
- `normalized_name`
- `website_url`
- `normalized_domain`
- `country_code`
- `region`
- `city`
- `company_type`
- `industry_labels`
- `size_estimate`
- `business_summary`
- `status`
- `review_decision_reason`
- `first_seen_at`
- `last_researched_at`
- timestamps

Lead statuses follow `docs/PRODUCT.md` and should be enforced through explicit transition rules.

### LeadIdentityKey

Implementation may use a dedicated table or deterministic fields to support deduplication.

Possible keys:

- normalized root domain;
- registry identifier plus country;
- normalized legal name plus address;
- provider-specific stable public ID where lawful and reliable.

Domain match is strong evidence of identity but not always sufficient for multi-brand groups, franchises, or country sites. Deduplication should retain the reason and confidence of a merge decision.

## 9. Sources and evidence

### Source

A retrieved public resource.

Typical fields:

- `id`
- `workspace_id`
- `source_type`
- `url`
- `normalized_url`
- `domain`
- `title`
- `retrieved_at`
- `published_at`, when known
- `content_hash`
- `fetch_status`
- `http_status`
- `language`
- `provider_metadata`
- `retention_class`
- timestamps

Source types may include:

- `company_website`
- `company_registry`
- `business_directory`
- `industry_association`
- `procurement_portal`
- `event_or_exhibitor_list`
- `public_professional_profile`
- `search_result`
- `uploaded_document`
- `other`

### LeadSource

Links a source to a lead and records relevance.

Typical fields:

- `lead_id`
- `source_id`
- `relationship_type`
- `is_primary`
- `relevance_summary`
- timestamps

### EvidenceClaim

A structured statement used by qualification or outreach.

Typical fields:

- `id`
- `workspace_id`
- `lead_id`
- `source_id`
- `claim_type`
- `subject`
- `predicate`
- `value`
- `text_summary`
- `source_excerpt`
- `source_locator`
- `confidence`
- `status`
- `extracted_by`
- `extraction_run_id`
- timestamps

Claim types:

- `fact`
- `inference`
- `unknown`
- `conflict`

Status values may include:

- `active`
- `superseded`
- `disputed`
- `rejected`

An inference should reference its supporting fact claims through a join table or stored claim references.

## 10. Qualification

### Qualification

A versioned assessment of a lead against campaign criteria.

Typical fields:

- `id`
- `workspace_id`
- `lead_id`
- `campaign_id`
- `strategy_version_id`
- `evidence_version`
- `status`
- `overall_score`
- `overall_confidence`
- `summary`
- `recommended_action`
- `model_execution_id`, when AI contributed
- timestamps

Statuses:

- `pending`
- `completed`
- `insufficient_evidence`
- `failed`
- `superseded`

### QualificationDimension

Typical fields:

- `qualification_id`
- `dimension`
- `score`
- `confidence`
- `explanation`
- `evidence_claim_ids`
- `is_blocking`

Initial dimensions:

- `industry_fit`
- `need_fit`
- `company_fit`
- `geography_fit`
- `commercial_fit`
- `contactability`
- `evidence_quality`
- `exclusion_risk`

Scores should use a documented bounded scale. The first implementation may use integers from 0 to 100, while confidence remains a separate value or label.

## 11. Contacts

### Contact

A public business contact route or publicly listed professional contact.

Typical fields:

- `id`
- `workspace_id`
- `lead_id`
- `contact_type`
- `name`
- `job_title`
- `department`
- `email`
- `phone`
- `contact_url`
- `source_id`
- `availability_status`
- `verification_status`
- `verification_method`
- `is_primary_for_campaign`
- timestamps

Contact types:

- `general_email`
- `department_email`
- `person_email`
- `contact_form`
- `phone`
- `professional_profile`
- `other`

Verification statuses:

- `unverified`
- `source_confirmed`
- `provider_verified`
- `invalid`
- `unknown`

A website listing an email supports `source_confirmed`; it does not prove mailbox delivery.

## 12. Outreach

### OutreachDraft

A versioned generated or user-edited message.

Typical fields:

- `id`
- `workspace_id`
- `lead_id`
- `campaign_id`
- `offer_version_id`
- `qualification_id`
- `language`
- `channel`
- `subject`
- `body`
- `variant_type`
- `status`
- `prompt_version`
- `model_execution_id`
- `evidence_claim_ids`
- `created_by_type`
- `approved_by`
- `approved_at`
- timestamps

Channels initially contain only `email` even though the model should not make email assumptions in unrelated entities.

Variant types may include:

- `primary`
- `short`
- `follow_up`

Draft statuses:

- `generated`
- `needs_review`
- `edited`
- `approved`
- `rejected`
- `superseded`

### OutreachAction

Records user actions without claiming delivery.

Possible action types:

- `copied`
- `opened_external_compose`
- `marked_contacted_manual`
- `marked_replied`

Later sending integrations should introduce distinct message and delivery entities rather than overloading this audit record.

## 13. AI execution

### ModelExecution

Auditable metadata for a structured AI task.

Typical fields:

- `id`
- `workspace_id`
- `task_type`
- `provider`
- `model`
- `prompt_version`
- `schema_version`
- `status`
- `input_reference`
- `output_reference`
- `attempt_count`
- `input_units`
- `output_units`
- `estimated_cost`
- `latency_ms`
- `error_category`
- timestamps

Avoid storing unrestricted sensitive prompt bodies in logs. Store durable task inputs only where product behavior requires them and retention is understood.

## 14. Activity and audit

### Activity

User-facing history for meaningful changes.

Examples:

- offer version approved;
- campaign started;
- lead approved or rejected;
- further research requested;
- draft approved;
- external compose opened;
- manual contact or reply status recorded.

### AuditEvent

Security-sensitive immutable event stream where needed.

Examples:

- membership role changed;
- data export requested;
- workspace deleted;
- provider credential changed;
- sending integration authorized later.

Activity and audit may share infrastructure but have different visibility and retention requirements.

## 15. Invariants

The implementation must preserve these rules:

1. A campaign and its offer belong to the same workspace.
2. A research run freezes one campaign strategy version and one offer version.
3. A lead belongs to one campaign and one workspace.
4. A qualification cannot cite evidence from another lead or workspace.
5. An approved outreach draft uses an approved offer version.
6. Prospect factual claims in a draft reference active evidence claims.
7. Opening an external compose window is not a sent-message event.
8. Retries do not create duplicate campaign leads, qualifications, or drafts for the same idempotency key.
9. Cross-workspace reads and writes are denied even when record IDs are guessed.
10. Rejected or superseded evidence remains auditable rather than disappearing silently.

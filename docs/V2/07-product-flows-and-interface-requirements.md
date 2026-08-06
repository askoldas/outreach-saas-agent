# Opptium Intelligence V2

## Product Flows and Interface Requirements

**Document:** 07  
**Status:** Implementation specification  
**Depends on:** `00-documentation-map-and-core-principles.md` through `06-workflow-orchestration-tasks-and-data-model.md`  
**Purpose:** Define the complete user-facing product behavior for Company Intelligence, campaign strategy creation, discovery, candidate review, corrections, scoped memory, approval, contact enrichment, and downstream lead handoff.

---

## 1. Purpose

Intelligence V2 changes the product from a form-driven lead search tool into an AI-led commercial intelligence workflow.

The interface must make that intelligence understandable and controllable without forcing the user to become a data analyst or prompt engineer.

The product must help the user answer, in sequence:

1. What does my company actually sell and how does it make money?
2. Which offering am I promoting in this campaign?
3. What kind of commercial relationship am I trying to create?
4. Which organizations in this geography are plausible targets, and why?
5. Which organizations are not valid targets, even if they look superficially similar?
6. What evidence did Opptium find for every recommendation?
7. What remains uncertain?
8. What should be approved, researched further, rejected, excluded, or merged?
9. Which user corrections should remain local to this campaign and which may be useful more broadly?
10. Which qualified companies should proceed to contact discovery and outbound preparation?

The interface is not a visual wrapper around model output. It is the control surface for a versioned, evidence-backed commercial reasoning system.

---

## 2. Scope

This document defines:

- product information architecture;
- primary navigation;
- route structure;
- workspace and active-company context;
- Company Profile onboarding and review;
- profile editing, publishing, and versioning;
- campaign creation and resumption;
- geography-first campaign setup;
- objective and offering confirmation;
- AI-proposed target strategy;
- campaign constraints and exclusions;
- market brief and strategy review;
- discovery execution and progress reporting;
- coverage, source, and iteration visibility;
- candidate result queues;
- compact result tables;
- expanded candidate views;
- evidence, scoring, confidence, and relationship presentation;
- correction, exclusion, and memory-scope controls;
- entity merge and split interactions;
- approval and contact-enrichment handoff;
- lead and sequence boundaries;
- usage and credit visibility;
- notifications and asynchronous workflow behavior;
- empty, loading, partial, paused, cancelled, failed, and stale states;
- accessibility, responsive behavior, keyboard use, and information density;
- user-facing terminology;
- permissions and collaboration behavior;
- telemetry requirements;
- implementation phases and acceptance criteria.

This document does not redefine:

- commercial intelligence schemas;
- provider interfaces;
- scoring formulas;
- Trigger.dev task internals;
- Supabase table definitions;
- model prompt contracts.

Those are defined in Documents 01–06. This file specifies how those contracts are exposed to users and how user actions must affect them.

---

## 3. Product Experience Goals

### 3.1 AI-led, not AI-hidden

Opptium should do the initial interpretation and propose the next step. The user should not need to create an ICP from an empty form.

At the same time, the system must not hide the assumptions that drive discovery and qualification.

The interface should consistently show:

- what Opptium understood;
- why it matters;
- which parts are confirmed;
- which parts are inferred;
- which parts remain unknown;
- what the user can change;
- what will happen after confirmation.

### 3.2 Commercial reasoning before volume

The interface must prioritize target logic over candidate counts.

A campaign with 500 discovered companies but an unclear commercial model is not a successful campaign. The product should not celebrate volume while hiding weak precision.

### 3.3 Progressive disclosure

Most users need a clear summary first and detail only when inspecting a decision.

Therefore:

- tables stay compact;
- long explanations live in expandable rows or side panels;
- evidence and score traces are available but not displayed as full-page blocks by default;
- advanced rule controls remain accessible without overwhelming campaign creation;
- the system surfaces important contradictions and uncertainties proactively.

### 3.4 User control without repetitive questionnaires

The user should be able to correct the AI quickly through:

- inline editing;
- structured controls;
- natural-language corrections;
- scope selection;
- approve, reject, exclude, merge, and re-evaluate actions.

The interface must not repeatedly ask the same generic questions for every offering or campaign.

### 3.5 Auditability without technical clutter

Every recommendation must be explainable, but the main experience should remain readable.

The default view should show the most important evidence and reasoning. Full provenance, versions, providers, and calculation traces should be available through secondary details.

### 3.6 Dense professional B2B interface

The product should use compact tables, restrained typography, short labels, and expandable detail rather than tall cards containing large text blocks.

One candidate row should normally fit within approximately 44–56 pixels before expansion, depending on viewport and density settings.

### 3.7 Async-first behavior

Profile analysis, market strategy compilation, discovery, research, and evaluation may take time.

The user must be able to:

- leave the page;
- return later;
- understand current state;
- see partial results where safe;
- pause or cancel supported stages;
- recover from failures;
- know what is waiting, running, completed, or blocked.

### 3.8 Scope-aware learning

The product must preserve campaign learning without allowing one campaign’s correction to silently distort all future campaigns.

The interface should make scope clear when it matters, but it should not turn “memory” into an oversized flagship feature.

---

## 4. Information Architecture

### 4.1 Primary navigation

The recommended primary navigation order is:

1. **Company Profile**
2. **Campaigns**
3. **Leads**
4. **Sequences**
5. **Usage & Credits**
6. **Settings**
7. **Help**

A standalone dashboard is not required for the initial Intelligence V2 release.

The Company Profile appears before Campaigns because campaigns depend on published Company Intelligence.

Usage & Credits, Settings, and Help should be visually secondary to the main workflow. They may use smaller or less prominent navigation treatment while remaining fully accessible.

### 4.2 Active workspace company

The application operates against one active workspace company at a time.

For the initial single-company release:

- the company identity appears at the top of the sidebar;
- clicking it opens Company Profile or a compact company menu;
- all campaigns, leads, sequences, memory, usage attribution, and settings are scoped to that company.

The shell should be compatible with a future company/workspace switcher without requiring route redesign.

A future switcher may show:

- active company name and logo;
- dropdown selection;
- `Add company` action;
- clear context change before loading another company’s campaigns.

Multi-company behavior is not required for the current refactor and must not delay Intelligence V2.

### 4.3 Route map

Suggested route structure:

```text
/company
/company/profile
/company/profile/edit
/company/profile/versions
/company/profile/versions/:versionId

/campaigns
/campaigns/new
/campaigns/:campaignId
/campaigns/:campaignId/setup
/campaigns/:campaignId/strategy
/campaigns/:campaignId/discovery
/campaigns/:campaignId/results
/campaigns/:campaignId/results/:candidateId
/campaigns/:campaignId/activity
/campaigns/:campaignId/settings

/leads
/leads/:leadId

/sequences
/sequences/:sequenceId

/usage
/settings
/help
```

The exact route naming may follow the existing Next.js structure, but route responsibilities must remain clear.

### 4.4 Campaign local navigation

After campaign creation, a campaign should expose local tabs or sections:

- **Overview**
- **Strategy**
- **Discovery**
- **Results**
- **Activity**
- optional **Settings**

The active tab depends on campaign state.

Examples:

- draft campaign opens Setup;
- strategy-building campaign opens Strategy progress;
- discovery-running campaign opens Discovery;
- review-ready campaign opens Results;
- completed campaign opens Results or Overview according to last user location.

### 4.5 Breadcrumbs and context

Deep pages should preserve context:

```text
Campaigns / Baltic branded apparel buyers / Results / Findys
```

The campaign title, status, target geography, selected offering, and objective should remain visible in a compact header on campaign routes.

---

## 5. Global Application Shell

### 5.1 Sidebar

The sidebar should contain:

- company identity or future switcher;
- primary workflow navigation;
- visually separated secondary navigation;
- collapsed state for smaller desktop widths;
- accessible labels and tooltips when collapsed.

The sidebar must not display unnecessary dashboard counters that compete with the campaign workflow.

### 5.2 Top bar

The global top bar may include:

- current page title;
- command or search trigger if implemented;
- notifications;
- account menu;
- contextual primary action.

Examples of contextual actions:

- Company Profile: `Update profile`
- Campaigns: `New campaign`
- Campaign result: `Approve selected`
- Leads: `Find contacts` or `Create sequence`

### 5.3 Status language

System status should be expressed in clear product language rather than raw job names.

Good:

- Analyzing website
- Building commercial model
- Preparing strategy
- Searching outlet retailers in Estonia
- Resolving duplicate companies
- Researching procurement compatibility
- Comparing qualified candidates

Avoid exposing internal names such as:

- `candidate.evaluateFactors`
- `discovery_pass_4`
- `task retry 2`

Technical details may appear in an advanced diagnostic view for support or development.

### 5.4 Global notification center

Long-running workflow completion should be surfaced through:

- in-app notification;
- optional email notification according to workspace settings;
- badge on Campaigns when new results require review.

Notifications should include a direct route to the relevant campaign state.

Examples:

- `Market strategy is ready for review.`
- `Discovery found 18 recommended companies and 11 requiring review.`
- `Contact enrichment completed for 7 approved companies.`
- `Campaign paused because the credit limit was reached.`

---

## 6. User Roles and Permissions

The first release may support a simple owner model, but UI behavior should anticipate collaboration.

Recommended roles:

### 6.1 Owner

Can:

- edit and publish Company Intelligence;
- create and confirm campaigns;
- change workspace-level rules;
- approve memory promotion;
- manage credits and settings;
- delete campaigns;
- manage members.

### 6.2 Editor

Can:

- edit profile drafts;
- create campaigns;
- edit strategy;
- review and correct candidates;
- approve leads;
- create sequences.

May not change billing or destructive workspace settings.

### 6.3 Reviewer

Can:

- view profile and campaigns;
- review candidate evidence;
- approve or reject candidates if permitted;
- add comments or corrections.

May not publish profile versions or change global rules unless explicitly granted.

### 6.4 Read-only

Can inspect current and historical states but cannot create corrections or actions.

### 6.5 Permission visibility

Disabled actions should explain why they are unavailable.

Do not silently hide critical status or evidence from read-only users.

---

## 7. Company Profile Entry States

The Company Profile route can have five primary states:

1. no profile;
2. analysis in progress;
3. draft ready for review;
4. published profile;
5. published profile with newer draft or stale source warning.

### 7.1 No-profile state

The first screen should ask for the company website and optionally support materials.

Required input:

- company website.

Optional inputs:

- short context note;
- uploaded presentation, catalogue, or brochure;
- preferred language;
- specific pages to include or ignore.

Primary action:

> Analyze company

Supporting copy should explain that Opptium will build a commercial profile and ask only for important missing information.

Avoid asking the user to manually fill:

- industry;
- company description;
- product list;
- ICP;
- decision-maker;
- market;
- product standalone status.

Those should initially be inferred.

### 7.2 Website validation

Before starting analysis, validate:

- URL syntax;
- domain reachability where possible;
- whether the site appears to belong to an operating company;
- obvious redirects;
- duplicate profile for the same workspace.

If the website cannot be reached, offer:

- retry;
- continue with uploaded materials;
- enter a brief company description manually;
- save and return later.

### 7.3 Analysis-progress state

Show a stage-based progress view:

1. Reading company sources
2. Identifying business model
3. Structuring offerings
4. Inferring buyer logic
5. Checking contradictions
6. Preparing questions

The progress view should include:

- current stage;
- completed stages;
- elapsed time;
- safe navigation notice;
- cancel action where supported;
- error recovery if a stage fails.

Do not show false percentage precision when task duration is uncertain. Use stage completion and qualitative progress.

### 7.4 Draft-ready state

When analysis completes, route the user to the profile review page.

The page should open with:

- concise company understanding;
- primary business model;
- offerings found;
- number of important assumptions;
- number of clarification questions;
- primary action to review and publish.

---

## 8. Company Profile Review Interface

### 8.1 Profile header

The header should show:

- company name;
- canonical domain;
- logo when reliable;
- profile status;
- draft or published version;
- last analysis date;
- primary action.

Primary actions by state:

- draft: `Review and publish`
- published: `Update profile`
- stale sources: `Refresh intelligence`
- draft plus published version: `Continue draft`

Secondary actions:

- view sources;
- compare versions;
- archive draft;
- profile settings.

### 8.2 Profile sections

The profile should be structured into sections rather than one generated narrative.

Recommended section order:

1. **Business model**
2. **Offerings**
3. **Commercial mechanics**
4. **Buyer and customer types**
5. **Partners and channels**
6. **Competitors and incompatible relationships**
7. **Buying triggers and qualification signals**
8. **Assumptions and open questions**
9. **Sources and evidence**

### 8.3 Business model section

Display:

- primary company role;
- secondary roles;
- position in value chain;
- what customers pay for;
- how revenue is generated;
- direct versus channel sales;
- recurring versus transactional relationship;
- who uses, pays for, resells, or integrates the offering;
- confidence and evidence status.

Use short structured rows with an optional expanded explanation.

Example:

```text
Primary role          Wholesale supplier
Revenue model         Wholesale orders
Customer use          Resale
Sales motion          Direct B2B
Order pattern         Repeat or seasonal purchasing
Confidence            High
```

### 8.4 Offering list

Each offering appears as a compact card or row with:

- offering name;
- one-sentence commercial description;
- status;
- likely buyer relationship;
- important constraint;
- confidence;
- edit action;
- expand action.

Offerings should be reorderable if priority matters.

The interface should warn when two offerings appear to require materially different buyer logic and therefore should remain separate.

### 8.5 Offering detail

Expanded offering detail should include:

- what is sold;
- who uses it;
- who pays;
- primary outcome;
- transaction or contract model;
- delivery model;
- minimum buyer conditions;
- suitable buyer business models;
- incompatible buyer models;
- likely triggers;
- procurement pattern;
- likely decision roles;
- substitutes and competing alternatives;
- evidence and assumptions.

The user can edit individual fields without rewriting the whole offering.

### 8.6 Claim-state presentation

Claims should use clear, unobtrusive labels:

- **Confirmed**
- **Supported by evidence**
- **AI assumption**
- **Unknown**
- **User corrected**
- **Conflicting evidence**

Do not rely on color alone.

A claim tooltip or detail panel should show:

- source;
- retrieval date;
- relevant evidence excerpt;
- confidence;
- why the claim matters;
- whether changing it affects campaigns.

### 8.7 Important questions

Clarification questions should be collected in one review block and also linked to affected sections.

Each question should explain why it matters.

Example:

> **Do customers buy this stock for resale, internal use, or both?**  
> This changes which company types should be treated as buyers.

Response patterns:

- structured option selection;
- short free-text answer;
- `Not sure`;
- `Skip for now`.

Questions must not be mandatory unless the profile cannot produce any safe campaign strategy without the answer.

Skipped questions remain visible as open uncertainty rather than silently disappearing.

### 8.8 Profile editing

Editing should support:

- inline field edit;
- structured selectors;
- natural-language correction;
- add or remove offering;
- split one offering into several;
- merge offerings when logic is truly shared;
- mark claim as incorrect;
- add evidence or source;
- add global or offering-scoped rule.

After a meaningful edit, show an impact preview:

- profile sections affected;
- existing campaign drafts affected;
- published campaigns unaffected unless explicitly re-evaluated;
- whether buyer hypotheses will be regenerated.

### 8.9 Publishing

Before publish, validate:

- at least one offering exists;
- business model is sufficiently resolved;
- critical contradictions are acknowledged;
- all mandatory fields have a valid state;
- profile version can compile a campaign strategy.

Publish confirmation should summarize:

- offerings included;
- unresolved assumptions;
- global rules;
- version number;
- campaigns that may use the version.

Primary action:

> Publish Company Profile

Publishing creates an immutable profile version.

### 8.10 Published profile behavior

Published content remains readable and editable through a new draft.

Do not edit an immutable published version in place.

The interface should clearly distinguish:

- currently published version;
- draft changes;
- previous versions.

---

## 9. Company Profile Rules and Exclusions UI

### 9.1 Purpose

Profile rules describe durable company or offering knowledge.

They should not be presented as a giant exclusion-management feature. They belong inside the relevant commercial section.

Examples:

- company-wide: `We do not sell to private consumers.`
- offering-level: `This service requires an internal IT team.`
- conditional: `Exclude competitors when the objective is direct customer acquisition.`

### 9.2 Rule anatomy

Each visible rule should show:

- statement;
- type;
- scope;
- applicability;
- strength;
- status;
- origin;
- edit action.

Example:

```text
Exclude brand-owned subsidiaries
Scope: Offering
Applies when: Objective is direct buyer
Strength: Hard
Status: User confirmed
```

### 9.3 Global does not mean unconditional

The UI should use `Workspace` or `Company-wide` rather than merely `Global` where possible.

A company-wide rule may still have conditions.

For example:

```text
Company-wide rule
Exclude existing customers from acquisition campaigns
```

This is broader than one campaign but not applicable to retention or expansion campaigns.

### 9.4 Deleting or changing a rule

Show impact before applying:

- draft campaigns affected;
- active campaigns using a snapshot are not silently changed;
- future campaigns use the new published profile version;
- re-evaluation can be initiated separately.

---

## 10. Campaign List

### 10.1 Campaign list layout

Use a compact table or dense list.

Recommended columns:

- campaign name;
- offering;
- objective;
- geography;
- status;
- recommended companies;
- needs review;
- last activity;
- owner;
- actions.

Avoid tall campaign cards unless used in a narrow viewport.

### 10.2 Campaign status values

User-facing statuses may include:

- Draft
- Building strategy
- Strategy ready
- Discovering
- Researching
- Comparing results
- Ready for review
- Paused
- Needs attention
- Completed
- Cancelled
- Archived

A campaign may have a high-level status plus a more specific current stage.

### 10.3 Campaign actions

Depending on status:

- Continue setup
- Review strategy
- View discovery
- Review results
- Pause
- Resume
- Duplicate campaign
- Archive
- Delete draft

Deletion of a campaign with completed work should require stronger confirmation than deleting an empty draft.

### 10.4 New campaign action

Primary action:

> New campaign

If no published Company Profile exists, route to profile completion with explanation.

If the published profile has critical unresolved issues, allow campaign setup but show a preflight warning and ask for only the missing information relevant to the selected offering.

---

## 11. Campaign Creation Flow

Campaign creation should be AI-led, resumable, and concise.

Recommended steps:

1. Geography
2. Objective and offering
3. Target hypothesis
4. Constraints and exclusions
5. Build market strategy
6. Review strategy
7. Confirm and start discovery

The interface may combine steps 2–4 on one responsive screen when the content is simple, but the logical stages must remain separate.

### 11.1 Draft persistence

Every meaningful change should save automatically.

A user can leave and resume without losing:

- geography;
- objective;
- offering selection;
- natural-language instructions;
- constraints;
- exclusions;
- strategy draft.

Show a subtle saved state rather than intrusive confirmations.

### 11.2 Campaign naming

The system should propose a campaign name after geography, objective, and offering are known.

Example:

> Premium European apparel wholesale — Baltics

The user can edit it at any time.

### 11.3 Step 1 — Geography

Geography is the first campaign question.

Support:

- country;
- multiple countries;
- named region;
- state or province;
- city or metro area;
- subregion exclusions.

After a named region is selected, show its normalized countries.

Example:

```text
Baltics
Latvia · Lithuania · Estonia
```

Allow the user to remove an included country.

The interface should infer likely search languages and source types without asking the user to configure them.

### 11.4 Geography validation

Warn when:

- the region is extremely broad;
- the selected market may contain very few targets;
- the offering has known geographic restrictions;
- the region conflicts with company delivery constraints;
- profile evidence suggests the company does not serve that area.

Warnings should be informative, not automatically blocking unless the constraint is confirmed as hard.

### 11.5 Step 2 — Objective

The system proposes the most likely objective.

Display objective options in commercial language:

- Find direct buyers
- Find end-user customers
- Find distributors
- Find resellers
- Find channel partners
- Find implementation partners
- Find suppliers
- Find strategic partners
- Custom objective

Each option should include a short explanation.

Changing objective should update:

- target relationship types;
- likely exclusions;
- target hypothesis;
- qualification logic;
- discovery segments.

### 11.6 Step 2 — Offering

Show AI-proposed offering first.

Each offering option includes:

- name;
- concise description;
- typical buyer type;
- important commercial condition;
- confidence.

Allow:

- select an existing offering;
- choose a campaign-specific variant;
- combine offerings only after compatibility validation;
- return to profile when the base offering is wrong.

A campaign-specific variant does not silently rewrite the published profile.

### 11.7 Step 3 — AI-proposed target hypothesis

The system should propose a clear target statement such as:

> Independent outlets, off-price chains, and multi-brand retailers in the Baltics that can purchase external branded stock for resale.

The target hypothesis view should show:

- target relationship;
- priority organization types;
- why they are plausible;
- required buyer capabilities;
- likely incompatible organizations;
- high-level procurement expectation;
- confidence and assumptions.

User actions:

- Accept
- Edit target
- Make broader
- Make stricter
- Add another archetype
- Remove an archetype
- Explain what is wrong

Natural-language correction should be translated into structured changes and shown back before application.

### 11.8 Step 4 — Constraints

Constraints should be optional and grouped by purpose.

Suggested groups:

- company scale;
- operating footprint;
- business model;
- purchasing or operational capability;
- required technology or certification;
- ownership and parent structure;
- existing relationships;
- custom conditions.

Each constraint must have a type:

- Required
- Preferred
- Research signal
- Exclusion
- Unknown to verify

The default should not make every user-entered preference a hard filter.

### 11.9 Step 4 — Exclusions

Campaign exclusions may include:

- existing customers;
- named companies;
- competitors for this objective;
- unsuitable company types;
- specific sizes;
- geographic exceptions;
- existing active opportunities;
- companies already contacted recently.

Default scope for exclusions created here:

> This campaign

The interface may show a compact scope control:

```text
Apply to
● This campaign
○ Campaigns for this offering
○ All relevant campaigns
```

Broader options should be available but not preselected.

When the user does not choose a broader scope, save the exclusion as:

- active campaign rule;
- provisional memory candidate;
- not automatically enforced elsewhere.

### 11.10 Natural-language campaign instruction

Provide an optional field:

> Anything else Opptium should consider?

Examples:

- `Focus on independent buyers rather than subsidiaries.`
- `Include second-hand chains only if they also purchase new stock.`
- `We want partners, not end users.`

The system must parse the instruction into explicit proposed rules and ask the user to confirm the interpretation when ambiguity is meaningful.

### 11.11 Campaign preflight summary

Before strategy compilation, show:

- geography;
- objective;
- offering;
- target hypothesis;
- important constraints;
- campaign exclusions;
- unresolved high-impact question count.

Primary action:

> Build market strategy

Do not label this action `Start discovery`, because discovery has not yet begun.

---

## 12. Market Strategy Compilation Experience

### 12.1 Progress stages

Show stages such as:

1. Adapting offering logic to the market
2. Understanding local market structure
3. Defining buyer archetypes
4. Building qualification rules
5. Planning discovery coverage
6. Preparing strategy review

This is a bounded market-orientation step, not full lead discovery.

### 12.2 Partial failure

If one source or market-analysis task fails:

- continue when safe;
- mark the affected section as lower confidence;
- allow retry of the failed step;
- do not discard completed strategy work.

### 12.3 Completion notification

When strategy compilation finishes:

- update campaign status to `Strategy ready`;
- notify the user;
- route primary campaign action to `Review strategy`.

---

## 13. Strategy Review Screen

The strategy review screen is one of the most important interfaces in Intelligence V2.

It must expose the commercial interpretation before expensive discovery begins.

### 13.1 Header

Show:

- campaign name;
- geography;
- offering;
- objective;
- strategy version state;
- last updated time;
- primary action.

Primary action:

> Confirm strategy and start discovery

Secondary actions:

- Edit setup
- Rebuild affected sections
- Save draft
- View strategy changes

### 13.2 Review layout

Recommended sections:

1. Market brief
2. Target strategy summary
3. Buyer archetypes
4. Qualification logic
5. Exclusions and exceptions
6. Discovery plan
7. Assumptions and open questions
8. Estimated breadth, cost, and uncertainty

### 13.3 Market brief

Keep the main brief concise.

It should explain:

- market shape;
- relevant local terminology;
- likely procurement structure;
- notable market constraints;
- expected size or uncertainty;
- which buyer types are likely concentrated or fragmented.

Provide an expanded evidence view for users who need the sources.

Do not present generic market commentary unrelated to targeting.

### 13.4 Target strategy summary

Show one clear statement:

> Opptium will prioritize [organization types] because [commercial reason], while treating [conditional types] as requiring additional evidence and excluding [incompatible relationships] for this objective.

The user should be able to edit this statement, but edits must compile back into structured strategy elements.

### 13.5 Buyer archetype cards or rows

Group archetypes by:

- Priority
- Conditional
- Exploratory
- Incompatible

Each archetype should show:

- name;
- short definition;
- why it is relevant;
- required capabilities;
- positive evidence signals;
- negative evidence signals;
- likely market coverage;
- priority;
- edit and remove actions.

Avoid displaying every query string here. Query details belong in the Discovery Plan advanced view.

### 13.6 Archetype editing

Support:

- change priority;
- edit definition;
- add required capability;
- add positive or negative signal;
- move to incompatible;
- restore removed archetype;
- add custom archetype;
- explain a natural-language correction.

When one edit affects qualification or discovery, show the dependent sections that will be regenerated.

### 13.7 Qualification logic

Display the factors selected for this campaign.

For each factor:

- label;
- why it matters;
- weight or relative importance;
- whether it is a critical gate;
- positive evidence expectation;
- negative evidence expectation;
- unknown handling.

The main UI can use qualitative importance labels:

- Critical
- High
- Medium
- Supporting

An advanced view may show numeric weights.

Users should not need to understand formulas to review strategy quality.

### 13.8 Exclusions and exceptions

Each rule should show:

- statement;
- type;
- scope;
- applicability;
- status;
- reason;
- origin.

Examples:

```text
Competing wholesalers
Excluded for: Direct buyer objective
Scope: This campaign
Status: AI proposed
```

```text
Existing customers
Excluded for: Acquisition campaigns
Scope: Company-wide rule
Status: User confirmed
```

Allow:

- confirm;
- change hard exclusion to preference;
- change scope;
- add exception;
- reject rule;
- leave as provisional.

### 13.9 Discovery plan

The user-facing plan should show semantic coverage, not only raw queries.

Example:

```text
Latvia
- Independent fashion outlets
- Multi-brand retailers with outlet sections
- Discount branded-fashion chains

Lithuania
- Independent fashion outlets
- Regional off-price chains

Estonia
- Independent fashion outlets
- Online branded discount retailers
```

Show source roles:

- web search;
- company websites;
- directories where relevant;
- future structured databases when enabled.

An advanced drawer may show planned search language, provider, query families, and stopping criteria.

### 13.10 Assumptions and open questions

Group into:

- assumptions safe enough to proceed;
- uncertainties that reduce confidence;
- issues requiring user decision.

The user should be able to:

- confirm;
- correct;
- leave unresolved;
- convert an assumption into a research question.

### 13.11 Expected breadth and cost

Where reliable, show an estimate range rather than false precision.

Example:

```text
Expected discoverable market: Small to medium
Likely unique organizations: 40–120
Deep evaluations planned: Up to 35
Estimated credit range: 28–55 credits
```

The estimate should explain major uncertainty drivers.

Do not imply that estimated lead count equals qualified lead count.

### 13.12 Strategy confirmation

Before confirmation, validate:

- objective exists;
- offering exists;
- geography exists;
- at least one active archetype exists;
- qualification policy is valid;
- no unresolved blocking contradiction exists;
- source plan is executable with current providers;
- estimated usage fits configured limits or has explicit approval.

Confirmation creates an immutable strategy version.

A confirmation dialog should summarize:

- target relationship;
- priority archetypes;
- key exclusions;
- estimated usage;
- what happens next.

Primary action:

> Confirm and start discovery

---

## 14. Strategy Revisions

### 14.1 Revision after confirmation

A confirmed strategy cannot be edited in place.

Selecting `Edit strategy` creates a new draft version.

Show a diff between current and proposed strategy:

- archetype added or removed;
- exclusion changed;
- factor weight changed;
- geography changed;
- offering or objective changed;
- source plan changed.

### 14.2 Impact preview

Before publishing a revision, show:

- candidates requiring re-evaluation;
- candidates likely excluded;
- discovery segments newly required;
- completed work that remains reusable;
- estimated additional cost;
- whether current run must pause.

### 14.3 Re-evaluation options

Offer:

- Re-evaluate affected candidates
- Re-evaluate all candidates
- Apply only to future candidates

The default should be `Re-evaluate affected candidates` when dependencies are known.

### 14.4 Historical access

Users should be able to view which strategy version produced each evaluation.

Historical versions are read-only.

---

## 15. Discovery Execution Screen

### 15.1 Purpose

The Discovery screen must show that the campaign is progressing through purposeful coverage, not opaque repeated iterations.

It should answer:

- what is being searched now;
- what has already been covered;
- how many unique organizations were found;
- where duplicates were removed;
- how many candidates reached each downstream stage;
- where market gaps remain;
- why another pass is running;
- when discovery is expected to stop.

### 15.2 Campaign progress header

Show:

- high-level status;
- current stage;
- elapsed time;
- active segment;
- progress across major stages;
- pause or cancel where supported;
- latest useful result count.

Example:

```text
Discovering companies
Searching Estonian off-price retailers · 4 of 9 segments covered
```

### 15.3 Stage timeline

Recommended stages:

1. Planning segments
2. Discovering companies
3. Resolving entities
4. Prefiltering
5. Researching plausible candidates
6. Evaluating evidence
7. Comparing results
8. Finalizing review queues

Each stage can be:

- waiting;
- running;
- partially complete;
- complete;
- skipped;
- blocked;
- failed.

### 15.4 Counters

Counters must use consistent definitions.

Recommended counters:

- Source records found
- Canonical companies
- Duplicates merged
- Prefiltered out
- Under research
- Evaluated
- Recommended
- Conditional
- Needs research
- Excluded
- Invalid

Do not display ambiguous counts such as `qualified` and `ready for review` when their relationship is unclear.

A tooltip should define each counter.

### 15.5 Coverage matrix

Show coverage by geography and archetype.

Example:

| Segment                     |         Latvia |  Lithuania |      Estonia |
| --------------------------- | -------------: | ---------: | -----------: |
| Independent outlets         |     Sufficient | Sufficient |          Low |
| Off-price chains            | Limited market | Sufficient | Insufficient |
| Multi-brand outlet sections |     Sufficient |   Moderate |     Moderate |

Coverage states:

- Not started
- In progress
- Insufficient
- Moderate
- Sufficient
- Market likely exhausted
- Not applicable

Coverage must be based on discovery yield and strategy criteria, not an arbitrary number of queries.

### 15.6 Active segment detail

Expanded detail may show:

- archetype;
- geography;
- provider;
- queries attempted;
- source records found;
- unique companies;
- downstream qualified yield;
- next action;
- reason for continuing or stopping.

### 15.7 Iteration explanation

When another pass starts, show a reason such as:

> Estonia has insufficient coverage for independent off-price retailers. Opptium is running a targeted local-language search.

Avoid:

> Iteration 4 of 5

A pass number may appear in diagnostics but not as the core user explanation.

### 15.8 Progressive results

The system may show candidates before the campaign is fully complete when:

- entity resolution is sufficiently stable;
- the candidate has a current evaluation;
- the row is clearly marked as provisional if comparative ranking is pending.

Use labels:

- Preliminary
- Evaluation complete
- Final ranking pending
- Final

Do not present provisional results as fully qualified.

### 15.9 Pause behavior

Pause should stop scheduling new work while allowing safe in-flight tasks to finish or checkpoint.

The UI should explain:

- what will stop;
- what may still complete;
- whether partial results remain available;
- how to resume.

### 15.10 Cancel behavior

Cancellation requires confirmation.

Explain:

- completed evidence remains saved;
- running work may stop after safe checkpoint;
- the campaign can be reviewed as incomplete;
- restarting may reuse completed work where valid.

### 15.11 Budget or credit stop

If limits are reached:

- pause the campaign;
- preserve state;
- show completed and pending work;
- explain estimated credits required to continue;
- allow user to reduce scope, adjust depth, add credits, or stop.

### 15.12 Discovery completion

When complete, show:

- final coverage summary;
- recommended count;
- conditional count;
- research-required count;
- excluded and invalid counts;
- notable market limitations;
- primary action `Review results`.

---

## 16. Discovery Activity and Diagnostics

### 16.1 User activity feed

The normal activity feed should include meaningful events:

- Strategy confirmed
- Discovery started
- First candidates found
- Duplicate organization group resolved
- New coverage gap identified
- Targeted pass started
- User corrected candidate relationship
- Campaign paused
- Comparative ranking completed

### 16.2 Technical diagnostics

A separate advanced view may include:

- workflow run identifiers;
- provider calls;
- prompt and model versions;
- retries;
- task failures;
- token and provider usage;
- raw timing.

This should not clutter the primary campaign experience.

### 16.3 Support export

Authorized users may export a diagnostic package containing:

- campaign and strategy identifiers;
- workflow events;
- provider errors;
- model versions;
- sanitized task metadata.

Do not include sensitive credentials or unnecessary raw personal data.

---

## 17. Results Information Architecture

### 17.1 Queue model

Results should be separated into meaningful queues:

1. **Recommended**
2. **Conditional**
3. **Needs research**
4. **Rejected**
5. **Excluded**
6. **Invalid & duplicates**

Optional user-facing labels may be:

- Recommended
- Review needed
- More research
- Rejected
- Excluded
- Data issues

The exact labels should remain consistent across the application.

### 17.2 Queue definitions

#### Recommended

Eligible candidates with sufficient evidence, acceptable confidence, and strong comparative position.

#### Conditional

Plausible candidates with meaningful uncertainty, a soft conflict, or a condition requiring user judgement.

#### Needs research

Candidates whose potential may justify additional research but whose current evidence is insufficient.

#### Rejected

Valid organizations that were evaluated and found commercially incompatible with this campaign.

#### Excluded

Candidates removed by an applicable hard rule, relationship conflict, explicit user instruction, or do-not-contact condition.

#### Invalid & duplicates

Directory pages, non-operating entities, malformed records, duplicate source records, merged storefronts, and related identity issues.

### 17.3 Queue counts

Counts must represent canonical candidate organizations, not raw source records.

Merged source records should not inflate queue totals.

### 17.4 Default landing queue

When results are ready, open **Recommended**.

If no recommended candidates exist, open the most actionable queue and explain why:

- Conditional if valid possibilities exist;
- Needs research if evidence is insufficient;
- campaign summary if the market appears exhausted.

---

## 18. Compact Candidate Results Table

### 18.1 Density

The default table should remain compact.

Avoid:

- large company logos;
- multi-paragraph summaries in cells;
- full explanations in rows;
- tall status cards;
- repeated location or category text.

Long information belongs in the expandable row or side panel.

### 18.2 Recommended columns

Core columns:

1. selection checkbox;
2. company;
3. relationship;
4. matched archetype;
5. fit;
6. potential;
7. confidence;
8. strongest evidence;
9. location;
10. status or action.

Optional columns:

- company scale;
- parent company;
- buying organization;
- evidence freshness;
- source count;
- owner or reviewer;
- contact status;
- last updated.

Users may configure visible columns, but default density should stay restrained.

### 18.3 Company cell

Show:

- canonical company name;
- domain;
- small optional favicon or logo;
- parent or group indicator when relevant;
- duplicate/branch indicator when relevant.

Do not show a localized storefront as an independent company without a visible relation indicator.

### 18.4 Relationship cell

Use labels such as:

- Probable buyer
- Possible buyer
- Distributor
- Partner
- Supplier
- Competitor
- Unknown

Relationship should be separate from queue status.

### 18.5 Fit, potential, and confidence

Show three independent values.

Suggested compact representation:

```text
Fit 86
Potential High
Confidence 74
```

Or separate columns with tooltips.

Do not show only a single overall score.

### 18.6 Strongest-evidence cell

Use one concise evidence statement, for example:

- `Explicit outlet and past-season stock model`
- `Operates 18 multi-brand stores across the Baltics`
- `Local procurement autonomy not confirmed`
- `Official distributor; stock-lot buying unclear`

Avoid generic text such as `Good industry fit`.

### 18.7 Sorting

Default sort for Recommended:

1. eligibility;
2. comparative rank;
3. fit;
4. confidence;
5. commercial potential.

Allow sorting by:

- fit;
- potential;
- confidence;
- company name;
- geography;
- scale;
- last updated.

Warn when sorting ignores comparative rank only if it may create misleading interpretation.

### 18.8 Filters

Recommended filters:

- queue;
- relationship;
- archetype;
- geography;
- fit range;
- potential;
- confidence range;
- company size;
- procurement autonomy;
- parent-company status;
- evidence state;
- source;
- user decision;
- contact status.

Filters must operate on canonical candidates.

### 18.9 Search

Search should match:

- company name;
- domain;
- parent company;
- brand;
- city and country;
- evidence keywords;
- archetype.

### 18.10 Row expansion

Rows should expand inline or open a side panel.

The chosen behavior should preserve table context and make next/previous review easy.

On wide screens, a side panel is preferred for fast review. On smaller screens, use a full-page detail route.

### 18.11 Row quick actions

Recommended quick actions:

- Approve
- Move to conditional
- Request more research
- Reject
- Exclude
- Correct classification
- Open website
- More actions

Do not place too many icon-only actions directly in every row.

### 18.12 Bulk actions

Bulk actions may include:

- Approve selected
- Request additional research
- Reject selected
- Apply campaign exclusion
- Export selected
- Start contact enrichment

Bulk exclusion or correction must show scope and impact before execution.

---

## 19. Candidate Detail View

### 19.1 Header

Show:

- canonical company name;
- website;
- location;
- parent company or buying group;
- relationship;
- eligibility;
- queue;
- fit;
- potential;
- confidence;
- primary review actions.

### 19.2 Recommended section order

1. Recommendation summary
2. Why it may fit
3. Risks and missing evidence
4. Relationship and eligibility
5. Qualification factors
6. Business model and offerings
7. Procurement and buying organization
8. Company identity and group structure
9. Evidence and sources
10. Campaign history and corrections
11. Contact readiness
12. Audit details

### 19.3 Recommendation summary

The summary should answer:

- what the company is;
- why it is relevant to this offering;
- what relationship is likely;
- what the strongest evidence is;
- what remains uncertain;
- what action is recommended.

Keep it to a few paragraphs or structured bullets.

### 19.4 Why it may fit

Show positive evidence grouped by commercial factor.

Example:

```text
Business-model compatibility
- Operates an outlet model focused on previous-season branded merchandise.

Purchasing capability
- Runs multiple stores and an online shop.

Offering compatibility
- Carries external European brands in the relevant price range.
```

### 19.5 Risks and missing evidence

Show:

- negative evidence;
- conflicting evidence;
- important unknowns;
- stale evidence;
- research recommendations.

Unknowns must be visually distinct from confirmed negatives.

### 19.6 Relationship and eligibility

Display separately:

```text
Relationship: Probable buyer
Eligibility: Eligible
Queue: Recommended
```

If excluded:

```text
Relationship: Competitor
Eligibility: Excluded
Reason: Competing stock wholesaler
Applicable rule: Direct-buyer campaigns exclude direct wholesalers
```

### 19.7 Qualification-factor breakdown

For every factor show:

- factor name;
- state;
- strength;
- confidence;
- evidence count;
- explanation;
- impact on fit or confidence.

States:

- Positive
- Negative
- Unknown
- Conflicting
- Not applicable

An advanced calculation view may show weights and deterministic score contributions.

### 19.8 Score explanation

The interface should explain scores in human terms.

Example:

> Fit is high because the company’s business model and inventory model match the offering. Confidence is moderate because local purchasing authority has not been confirmed.

Do not present the score as a mysterious model opinion.

### 19.9 Business model and offerings

Show reusable Candidate Intelligence:

- primary role;
- business model;
- products and services;
- customer model;
- operating footprint;
- company size indicators;
- source freshness.

Clearly distinguish reusable company facts from campaign-specific conclusions.

### 19.10 Procurement and buying organization

Where relevant, show:

- likely buying entity;
- local versus centralized purchasing;
- parent company;
- procurement autonomy;
- evidence;
- unresolved question.

Localized storefronts should show the parent or group relationship prominently.

### 19.11 Entity graph

An advanced identity section may visualize:

```text
Parent group
├── Legal entity
├── Country storefront
├── Brand
└── Branch locations
```

The interface should support inspecting why source records were merged.

### 19.12 Sources

Each evidence source should show:

- page title or provider;
- URL where allowed;
- source type;
- retrieval date;
- excerpt or structured field;
- evidence quality;
- which claim or factor it supports;
- stale or inaccessible status.

Avoid showing raw provider JSON in the normal interface.

### 19.13 Historical campaign evaluations

If the candidate appeared in previous campaigns, show only relevant workspace history:

- campaign;
- objective;
- relationship;
- decision;
- date;
- user correction;
- whether the previous conclusion is reusable.

Do not reuse old fit scores without recalculation.

---

## 20. Candidate Review Actions

### 20.1 Approve

Approval means the company is accepted as a valid target for the campaign.

Approval should:

- set user decision;
- preserve current evaluation;
- make the company eligible for contact discovery;
- update review progress;
- record user and time;
- optionally capture a short note.

Approval does not automatically start paid contact enrichment unless workspace settings explicitly enable that behavior.

### 20.2 Conditional approval

Allow approval with a condition, for example:

- verify purchasing authority;
- confirm minimum order capacity;
- find regional buyer;
- approach only through parent company.

Conditions should carry into contact selection and outbound preparation.

### 20.3 Request more research

The user may select a research question or enter one.

Examples:

- Does the company buy external stock lots?
- Is purchasing centralized at the parent company?
- Does the company operate active stores in Estonia?

Before running, show:

- expected source depth;
- estimated credit use;
- whether existing evidence may be reused.

### 20.4 Reject

Reject means a valid organization is not suitable for the current campaign.

Require or encourage a reason:

- incompatible business model;
- insufficient scale;
- wrong customer model;
- no relevant offering fit;
- user judgement;
- other.

Rejection is campaign-scoped by default.

### 20.5 Exclude

Exclude is stronger than reject.

Use when:

- an explicit rule applies;
- do-not-contact status exists;
- company is a competitor for this objective;
- existing customer must be excluded;
- legal or policy constraint applies;
- user intends a repeatable rule.

The interface must ask or infer scope safely.

Default:

> This campaign

### 20.6 Correct classification

Correction options may include:

- relationship;
- business model;
- archetype;
- parent company;
- buying organization;
- procurement autonomy;
- location;
- entity type;
- duplicate state;
- evidence interpretation.

After correction, show affected conclusions and request confirmation before broad recomputation when cost is meaningful.

### 20.7 Undo

Recent reversible actions should support undo where safe:

- queue movement;
- rejection;
- campaign-scoped exclusion;
- approval;
- simple classification correction.

Entity merges, global rule changes, or completed paid enrichment require explicit reversal workflows rather than lightweight undo.

---

## 21. Scope-Aware Correction and Exclusion UX

### 21.1 Principle

A user correction inside one campaign is valuable memory, but it is not automatically universal truth.

The UI must distinguish immediate action from possible broader learning.

### 21.2 Default behavior

When the user creates a correction during a campaign:

1. apply it to the current candidate or campaign;
2. save origin and reason;
3. preserve it as provisional memory when broader reuse may be useful;
4. do not enforce it across unrelated campaigns;
5. offer promotion only when context supports it.

### 21.3 Scope options

Depending on correction type, show:

- This candidate only
- This campaign
- Campaigns for this offering
- All relevant campaigns for this company

Do not show invalid scopes.

Example:

- correcting a candidate’s legal name is reusable candidate intelligence;
- rejecting a company because the campaign has a temporary budget is campaign-only;
- excluding companies without an internal IT team may be offering-level;
- marking a company `Do not contact` may be workspace-wide candidate memory.

### 21.4 Scope explanation

Each scope option should include a brief consequence.

Example:

```text
This campaign
Use the rule only in this campaign. Opptium may suggest it again later.

Campaigns for this offering
Use the rule whenever this offering is targeted, unless a campaign overrides it.

All relevant campaigns
Save as company-wide commercial knowledge with applicability conditions.
```

### 21.5 Provisional memory indicator

A campaign correction that might matter later may show a subtle label:

> Remembered for this campaign

Avoid prominent language implying permanent autonomous learning.

### 21.6 Promotion suggestions

Promotion should be suggested when:

- the same correction appears repeatedly;
- the user explicitly says it is always true;
- evidence strongly supports offering-wide applicability;
- the rule is necessary to avoid repeated false positives.

Example:

> You excluded agencies in three direct-buyer campaigns for this offering. Save this as an offering rule?

Actions:

- Save for offering
- Keep campaign-specific
- Dismiss

### 21.7 No silent promotion

The system must not silently convert:

- one rejected candidate into a global exclusion;
- one campaign rule into a workspace rule;
- one inferred competitor pattern into permanent knowledge;
- one low-confidence observation into a hard rule.

---

## 22. Campaign Memory Interface

### 22.1 Memory as product behavior

Campaign memory is primarily visible through better behavior:

- no repeated searches;
- consistent evaluation;
- corrections applied to later candidates;
- targeted gap searches;
- preserved strategy decisions.

It does not require a large standalone `Memory` page.

### 22.2 Campaign decisions panel

A compact `Campaign decisions` panel may show active user and system conclusions:

- current campaign exclusions;
- important user corrections;
- strategy adjustments;
- unresolved research rules;
- superseded decisions.

Each record shows:

- statement;
- source;
- scope;
- created time;
- status;
- affected segments or factors.

### 22.3 Working memory visibility

Discovery working memory appears through:

- coverage matrix;
- attempted queries or source families;
- market gaps;
- previous segment yield;
- next-pass explanation.

Do not expose a raw model memory dump.

### 22.4 Conflict handling

When a campaign rule conflicts with a broader rule, show:

```text
Campaign exception
This campaign includes distributors as target partners.

Broader rule
Distributors are excluded from direct-buyer campaigns.
```

The campaign-specific rule wins for the current objective without deleting the broader rule.

### 22.5 Superseded memory

Old campaign decisions remain available in history but should not appear as active.

Show:

- superseded by;
- time;
- user or system source;
- effect on evaluations.

---

## 23. Entity Resolution UI

### 23.1 Duplicate indicators

When multiple source records map to one candidate, show:

- source count;
- domains or storefronts merged;
- canonical company;
- confidence of the merge.

The normal results table should show one candidate row.

### 23.2 Potential duplicate review

Low-confidence merges should enter a data-quality review state.

Present side-by-side:

- names;
- domains;
- locations;
- legal identifiers;
- parent relations;
- evidence;
- why the system suspects a match.

Actions:

- Merge
- Keep separate
- Link as related entities
- Research further

### 23.3 Merge impact

Before merge, show:

- evaluations that will consolidate;
- campaign decisions affected;
- lead or contact records affected;
- which canonical identity will remain;
- whether the action is reversible.

### 23.4 Split

Allow authorized users to split an incorrect merge.

The split workflow must:

- preserve original source records;
- ask which evidence and evaluations belong to each entity;
- re-run affected entity and candidate logic;
- preserve audit history.

### 23.5 Parent and storefront handling

When a localized storefront is found, the interface should distinguish:

- operating presence;
- legal entity;
- buying organization;
- parent company.

Example:

```text
Newmood Estonia
Operating storefront in Estonia
Buying organization: Newmood Group
Evaluated as one buying organization
```

---

## 24. Comparative Ranking Presentation

### 24.1 Purpose

Comparative ranking detects contradictions that isolated evaluation misses.

The UI should make ranking useful without presenting another unexplained score.

### 24.2 Rank explanation

For top candidates, show concise comparison notes:

- ranked above another candidate because direct buying evidence is stronger;
- ranked below because procurement autonomy is uncertain;
- moved to conditional because category similarity was not supported by buying evidence.

### 24.3 Inversion alerts

If the consistency checker detects an inversion, show an internal correction or review alert.

Example:

> This candidate has direct evidence of the target buying model but was ranked below candidates with only category similarity. Evaluation was recalculated.

The system should resolve straightforward deterministic inconsistencies automatically and log the change.

### 24.4 Manual reorder

Users may manually prioritize approved candidates.

Manual priority should be stored separately from system comparative rank.

Columns or labels:

- System rank
- User priority

Do not overwrite the system evaluation when the user simply wants to contact one company first.

---

## 25. Campaign Overview

### 25.1 Purpose

The campaign overview summarizes state and next action without duplicating every detail.

### 25.2 Recommended contents

- campaign objective;
- selected offering;
- geography;
- strategy version;
- status;
- recommended and pending counts;
- coverage summary;
- review progress;
- approved companies;
- contact enrichment state;
- credits used;
- current blockers;
- next recommended action.

### 25.3 Next-action logic

Examples:

- draft: `Continue campaign setup`
- strategy ready: `Review strategy`
- discovering: `View discovery progress`
- results ready: `Review recommended companies`
- companies approved: `Find decision-makers`
- contacts ready: `Create outbound sequence`

### 25.4 Market limitation summary

If the market is small or exhausted, show it clearly.

Example:

> Opptium found a limited number of organizations matching the confirmed buyer model in this geography. Expanding to adjacent archetypes would increase volume but reduce precision.

Offer deliberate options rather than silently broadening the ICP.

---

## 26. Approval and Company-to-Lead Handoff

### 26.1 Company approval precedes contact enrichment

A company should normally be approved before paid contact enrichment begins.

This prevents spending credits on weak or excluded companies.

### 26.2 Approved-company queue

The campaign should expose approved companies with:

- approval state;
- reviewer;
- conditions;
- target buying roles;
- contact enrichment status;
- next action.

### 26.3 Role proposal

Based on offering and campaign strategy, Opptium should propose relevant roles.

Examples:

- Procurement Director
- Category Manager
- Founder
- Head of Partnerships
- IT Director
- Operations Manager

The proposal should distinguish:

- economic buyer;
- functional owner;
- procurement role;
- executive sponsor;
- technical evaluator;
- fallback role.

The user may edit roles before enrichment.

### 26.4 Enrichment preview

Before starting contact search, show:

- approved company count;
- proposed roles;
- target contacts per company;
- estimated credit use;
- provider availability;
- fallback behavior when no contact is found.

Primary action:

> Find contacts

### 26.5 Contact-search states

Per company:

- Not started
- Queued
- Searching
- Contacts found
- Partial
- No suitable contact
- Needs review
- Failed

### 26.6 No-contact fallback

When no named contact is found, allow:

- search another role;
- research the company website;
- retain company-level general contact;
- mark for manual research;
- skip.

The system should not invent a person.

---

## 27. Leads Interface

### 27.1 Lead model

The Leads section should present a flattened contact list while preserving company grouping.

Example:

```text
Company A — Contact 1
Company A — Contact 2
Company B — Contact 1
```

Rows may be expandable to show company and campaign context.

This gives users a direct actionable list without forcing navigation through nested company cards.

### 27.2 Recommended columns

- person;
- title;
- company;
- buying role;
- campaign;
- confidence;
- email or contactability state;
- source freshness;
- sequence status;
- owner;
- actions.

### 27.3 Company group behavior

Allow:

- group by company;
- group by campaign;
- flat view;
- expand company context;
- select one or multiple contacts per company.

### 27.4 Contact confidence

Separate:

- employment confidence;
- role relevance;
- contact-data confidence;
- deliverability state where available.

Do not combine these into one opaque contact score.

### 27.5 General versus named contact

The lead model should support:

- named person;
- role mailbox;
- general company contact;
- no-contact company record awaiting research.

Outbound drafts should adapt accordingly.

---

## 28. Sequence Handoff

### 28.1 Boundary

Intelligence V2 ends company qualification and prepares relevant contact context. Sequences consume that context.

### 28.2 Sequence creation entry points

- from selected Leads;
- from approved companies after enrichment;
- from a campaign overview;
- from the Sequences section.

### 28.3 Context passed to sequence generation

Pass:

- workspace company and offering;
- campaign objective;
- target archetype;
- candidate fit evidence;
- buying triggers;
- relevant contact role;
- user corrections;
- exclusions and communication constraints;
- approved claims only.

Do not pass hidden speculative claims as facts in outbound copy.

### 28.4 Draft state

For the prototype, sequence output may remain draft/export based rather than sent automatically.

The interface should clearly distinguish:

- generated draft;
- reviewed draft;
- approved for export;
- exported;
- sent by an external provider if integration exists later.

---

## 29. Usage and Credits Interface

### 29.1 Purpose

Usage should explain what consumed credits and what is expected to consume more.

### 29.2 Usage categories

Recommended categories:

- company profile analysis;
- market strategy analysis;
- company discovery;
- deep candidate research;
- additional research requests;
- contact enrichment;
- outbound draft generation.

### 29.3 Campaign usage

Campaign overview and discovery should show:

- credits used;
- estimated remaining work;
- provider or stage breakdown where useful;
- current campaign limit;
- reason for any pause.

### 29.4 Estimate language

Use ranges when uncertainty is high.

Example:

> Continuing research on 12 candidates is estimated to use 8–14 credits.

### 29.5 Approval gates

Require explicit confirmation before unusually expensive actions, such as:

- expanding a broad geography;
- deep-researching many conditional candidates;
- enriching contacts across all discovered companies;
- re-evaluating an entire campaign after major strategy change.

### 29.6 Do not expose sector pricing logic as arbitrary discrimination

The product may consume different amounts of work or credits according to research depth and market difficulty, but the interface should explain operational consumption rather than claim that one industry is simply “worth more.”

---

## 30. Empty States

### 30.1 Company Profile empty state

Explain that the profile is required to create accurate campaigns.

Primary action:

> Analyze your company

### 30.2 Campaign list empty state

Explain the flow:

> Choose a market, confirm an offering and target strategy, then let Opptium discover and qualify companies.

Primary action:

> Create first campaign

### 30.3 Recommended queue empty

Possible messages:

- No candidates have completed evaluation yet.
- No companies met the confirmed strategy.
- Recommended results are empty, but conditional candidates are available.
- The selected market may be too narrow.

Provide the relevant next action rather than a generic empty illustration.

### 30.4 Leads empty state

Differentiate:

- no approved companies;
- approved companies but enrichment not started;
- enrichment running;
- no suitable contacts found.

### 30.5 Sequences empty state

Explain that sequences are created from selected qualified contacts or approved companies.

---

## 31. Loading and Skeleton States

### 31.1 Principles

- preserve page layout;
- avoid full-screen spinners for long workflows;
- show known state immediately;
- display last completed data while refreshing;
- use skeletons only for short data fetches;
- use stage progress for long AI workflows.

### 31.2 Candidate table loading

Load table structure first, then rows.

Do not block filters and tabs unnecessarily when counts are already known.

### 31.3 Detail refresh

When a candidate is being re-evaluated, preserve old evaluation with a clear label:

> Re-evaluation in progress · showing previous result

---

## 32. Error and Recovery States

### 32.1 Error categories

User-facing error states should distinguish:

- source unavailable;
- provider rate limit;
- website blocked;
- model output invalid;
- task retrying;
- task permanently failed;
- insufficient evidence;
- strategy invalidated;
- credit limit reached;
- permission denied;
- network or session error.

### 32.2 Retry behavior

Offer retry at the smallest safe scope:

- retry one source;
- retry one candidate research task;
- retry one discovery segment;
- rebuild affected strategy section;
- resume entire campaign only when necessary.

### 32.3 Partial results

A partial campaign must remain reviewable.

Show:

- completed coverage;
- incomplete segments;
- candidates with complete evaluation;
- candidates still provisional;
- what failed;
- estimated impact.

### 32.4 Invalid model output

Do not expose raw validation errors to normal users.

Show:

> Opptium could not complete this analysis reliably. The task will be retried.

Advanced diagnostics may expose schema details.

### 32.5 Stale strategy

If the Company Profile changes while a campaign draft is open:

- mark the campaign draft as based on an older profile version;
- show the profile changes;
- offer to update the draft or keep the existing version.

A running confirmed campaign remains tied to its immutable profile and strategy snapshot.

---

## 33. Pause, Resume, Cancel, Archive, and Delete

### 33.1 Pause

Pause applies to active campaign work.

It should:

- stop new task scheduling;
- allow safe checkpointing;
- retain completed work;
- expose resume action.

### 33.2 Resume

Resume should validate:

- strategy version still valid;
- provider credentials available;
- credit limit sufficient;
- no blocking workspace change;
- leases and queued tasks recovered safely.

### 33.3 Cancel

Cancel stops the current run, not necessarily the campaign record.

The campaign may become:

- Incomplete
- Cancelled run
- Review partial results

### 33.4 Archive

Archive hides a campaign from the active list while preserving all versions, evidence, and audit history.

### 33.5 Delete

Allow deleting:

- empty drafts;
- test campaigns according to retention policy.

Completed campaigns with dependent leads or sequences should normally be archived rather than hard deleted.

---

## 34. Version and Audit Interface

### 34.1 Version visibility

Users should be able to identify:

- profile version;
- offering version;
- strategy version;
- evaluation version;
- ranking version.

The main interface may hide technical identifiers but should show human-readable version numbers and dates.

### 34.2 Version comparison

Provide diff views for:

- profile updates;
- offering changes;
- campaign strategy revisions;
- candidate evaluation before and after correction.

### 34.3 Audit events

Important user-visible events:

- profile published;
- strategy confirmed;
- strategy revised;
- campaign started;
- rule added;
- correction made;
- candidate approved or rejected;
- memory promoted;
- entities merged or split;
- contact enrichment started;
- credits consumed by major action.

### 34.4 Explanation access

A user should be able to answer:

> Why is this company here?

The system should show:

- discovery segment;
- source;
- matched archetype;
- evidence;
- applicable rules;
- evaluation factors;
- comparative reasoning;
- user corrections.

---

## 35. User-Facing Terminology

### 35.1 Preferred terms

Use:

- Company Profile
- Offering
- Campaign objective
- Target strategy
- Buyer archetype
- Qualification
- Relationship
- Recommended
- Conditional
- Needs research
- Excluded
- Confidence
- Evidence
- Campaign decision
- Company-wide rule
- Offering rule
- Campaign rule

### 35.2 Terms to avoid or limit

Avoid in normal UI:

- agent memory vector;
- chain of thought;
- hallucination;
- LLM score;
- embeddings;
- node;
- graph state;
- job payload;
- raw iteration number;
- provider record ID;
- schema validation error.

### 35.3 “Lead” terminology

Before approval, use:

- candidate company;
- company;
- prospect candidate.

Use `Lead` primarily after company approval and contact enrichment, or where the existing product naming requires it.

This prevents treating every raw discovered company as a qualified lead.

### 35.4 “Qualified” terminology

Do not use `qualified` ambiguously.

Prefer:

- Evaluation complete
- Recommended
- User approved
- Contact ready

These describe distinct states.

---

## 36. Visual Design and Density

### 36.1 Overall style

The interface should feel like a serious B2B intelligence application:

- restrained;
- precise;
- compact;
- calm;
- evidence-oriented;
- not playful or chat-dominated.

### 36.2 Typography

Use a clear hierarchy:

- page title;
- section title;
- compact body text;
- metadata;
- table text;
- status labels.

Avoid oversized body typography that causes result rows to become tall.

### 36.3 Table density

Support at least:

- Comfortable
- Compact

Compact should be the default for candidate and lead lists.

### 36.4 Status color

Color may support status, but every status must have text or icon plus accessible label.

Suggested semantic groups:

- positive/recommended;
- warning/conditional;
- neutral/research;
- negative/rejected;
- excluded;
- system/data issue.

Exact colors belong to design tokens and must meet contrast requirements.

### 36.5 Cards versus tables

Use cards for:

- campaign setup choices;
- strategy summaries;
- profile offerings;
- small grouped insight blocks.

Use tables for:

- campaigns;
- candidates;
- leads;
- evidence lists;
- version history;
- usage details.

### 36.6 Expandable content

Long explanations should expand without shifting the entire page unpredictably.

Preferred patterns:

- row expansion;
- side panel;
- details drawer;
- dedicated detail route.

### 36.7 Icons

Icons should reinforce clear labels, not replace them in critical actions.

---

## 37. Responsive Behavior

### 37.1 Desktop priority

The primary review workflow is desktop-oriented because it involves dense tables and evidence comparison.

### 37.2 Tablet

On tablet:

- collapse secondary columns;
- use side panel as full-width drawer;
- preserve queue tabs and filters;
- retain core actions.

### 37.3 Mobile

Mobile should support:

- viewing campaign status;
- reviewing key candidate summaries;
- approving or rejecting simple cases;
- receiving notifications;
- adding short corrections.

Complex strategy editing, entity merge, and large bulk actions may recommend desktop, but routes must remain functional and readable.

### 37.4 Mobile candidate row

Use stacked compact fields:

- company;
- relationship and queue;
- fit, potential, confidence;
- strongest evidence;
- primary action.

Avoid horizontally squeezed desktop tables.

---

## 38. Accessibility

### 38.1 Keyboard navigation

Users must be able to:

- move through table rows;
- open candidate detail;
- switch queues;
- apply filters;
- confirm dialogs;
- edit fields;
- use bulk selection.

### 38.2 Focus management

When opening a drawer or modal:

- move focus inside;
- trap focus where appropriate;
- return focus to the triggering control on close.

### 38.3 Screen-reader labels

Provide meaningful labels for:

- scores;
- confidence states;
- expandable rows;
- evidence status;
- scope selectors;
- asynchronous progress;
- selected candidates.

### 38.4 Color independence

Never rely only on color for:

- positive versus negative evidence;
- hard exclusion;
- unknown state;
- campaign status;
- stale data;
- conflict.

### 38.5 Motion

Progress animation and transitions should respect reduced-motion preferences.

---

## 39. Search, Filters, and Saved Views

### 39.1 Filter persistence

Persist filters within a campaign session and optionally per user.

Do not silently carry filters between unrelated campaigns when that may hide results.

### 39.2 Saved views

A later release may support saved views such as:

- High fit, low confidence
- Approved companies without contacts
- Parent companies only
- Estonia candidates requiring research

Saved views are user preferences, not commercial intelligence rules.

### 39.3 Filter chips

Display active filters as removable chips.

Show a clear `Reset filters` action.

### 39.4 Empty filtered state

Differentiate:

- no results in queue;
- no results matching current filters.

---

## 40. Comments and Collaboration

### 40.1 Candidate comments

Allow workspace members to leave comments on:

- candidate;
- evidence;
- correction;
- approval decision.

Comments do not automatically become intelligence claims.

### 40.2 Convert comment to correction

Authorized users may explicitly convert a comment into:

- candidate correction;
- campaign rule;
- research request;
- profile update proposal.

### 40.3 Decision ownership

Show who:

- approved;
- rejected;
- added an exclusion;
- changed rule scope;
- promoted memory;
- merged entities.

### 40.4 Conflicting reviewer decisions

If two reviewers conflict:

- preserve both actions;
- mark candidate as needing resolution;
- require authorized final decision;
- do not silently overwrite.

---

## 41. Natural-Language Interaction

### 41.1 Role of chat-like input

Natural-language input should supplement structured workflows, not replace the application with one continuous chat.

Useful placements:

- Company Profile correction;
- campaign target adjustment;
- strategy correction;
- candidate research question;
- explanation request.

### 41.2 Interpretation preview

When a natural-language instruction changes structured logic, show what Opptium understood.

Example:

User:

> Do not include agencies unless they can act as referral partners.

System interpretation:

```text
Direct-buyer relationship: Agencies excluded
Referral-partner relationship: Agencies conditional
Scope: This campaign
```

Actions:

- Apply
- Edit interpretation
- Cancel

### 41.3 Avoid repeated confirmation for trivial changes

Simple low-risk edits may apply immediately with undo.

High-impact or broad-scope changes require explicit confirmation.

---

## 42. Notifications and Follow-Up

### 42.1 In-app notifications

Notify when:

- profile draft ready;
- strategy ready;
- campaign requires user decision;
- discovery complete;
- research request complete;
- contact enrichment complete;
- campaign paused or failed;
- memory promotion suggestion available.

### 42.2 Email notifications

Workspace settings may support:

- only action-required events;
- all campaign completions;
- daily summary;
- disabled.

### 42.3 Notification deduplication

Do not send repeated notifications for every candidate task.

Group events meaningfully.

### 42.4 Deep links

Every notification should open the exact relevant page or filtered queue.

---

## 43. Telemetry and Product Analytics

### 43.1 Purpose

Analytics should measure whether the interface helps users create better strategies and review results efficiently.

### 43.2 Profile metrics

Track:

- time to first published profile;
- number of AI claims accepted, edited, or rejected;
- clarification-question completion;
- offering split or merge frequency;
- profile refresh frequency;
- critical profile failure reasons.

### 43.3 Campaign setup metrics

Track:

- time from campaign creation to confirmed strategy;
- objective changes;
- offering changes;
- archetype edits;
- exclusion additions;
- natural-language corrections;
- strategy abandonment;
- estimated versus actual discovery cost.

### 43.4 Discovery metrics

Track:

- time to first candidate;
- time to first recommended candidate;
- segment coverage;
- duplicate suppression rate;
- provider yield;
- gap-pass frequency;
- pause and cancellation reasons.

### 43.5 Review metrics

Track:

- top-10 approval rate;
- recommended-to-approved rate;
- conditional-to-approved rate;
- candidate review time;
- correction categories;
- exclusion-scope choices;
- research-request rate;
- score inversion frequency;
- entity correction frequency.

### 43.6 Memory metrics

Track:

- provisional corrections reused;
- promotion suggestions shown;
- promotion acceptance rate;
- rules later reverted;
- conflicts resolved by campaign exception.

### 43.7 Privacy

Do not record sensitive free-text content in analytics when event metadata is sufficient.

Product analytics and intelligence evidence are separate systems.

---

## 44. Feature Flags and Legacy Coexistence

### 44.1 Intelligence V2 flag

Support a workspace or campaign-level feature flag:

```text
intelligence_v2_enabled
```

### 44.2 Legacy campaigns

Legacy campaigns remain viewable through their existing result model.

Do not pretend legacy holistic scores have the same meaning as V2 fit, potential, and confidence.

Use a visible label:

> Legacy evaluation

### 44.3 New campaign default

During controlled rollout:

- selected workspaces may choose V2;
- later, new campaigns default to V2;
- legacy remains available temporarily for comparison;
- eventually, legacy campaign creation is disabled.

### 44.4 Side-by-side benchmark mode

Internal or pilot users may run the same campaign through both systems.

The comparison interface may show:

- candidate overlap;
- unique candidates;
- top-10 precision review;
- competitor leakage;
- duplicate rate;
- runtime;
- cost;
- user approval rate.

This is an internal validation experience, not a standard customer feature.

---

## 45. Route Guards and Preconditions

### 45.1 Company Profile guard

Campaign creation requires:

- published profile;
- at least one offering;
- no unresolved blocking profile conflict.

When missing, route to the smallest required profile-completion step.

### 45.2 Strategy guard

Discovery requires:

- confirmed strategy version;
- valid geography;
- valid objective;
- selected offering;
- executable source plan;
- sufficient permissions;
- credit approval.

### 45.3 Results guard

Results may open while running, but provisional state must be visible.

### 45.4 Contact-enrichment guard

Contact enrichment requires:

- approved company or explicit override;
- selected target roles;
- usage estimate acceptance where required;
- provider availability.

### 45.5 Sequence guard

Sequence generation requires:

- selected lead or approved company;
- valid offering and campaign context;
- no do-not-contact rule;
- sufficient approved evidence for personalization.

---

## 46. UI View Models and Contracts

The UI should consume purpose-built view models rather than joining raw persistence tables directly in components.

### 46.1 Campaign list item

```ts
type CampaignListItemView = {
  id: string;
  name: string;

  offering: {
    id: string;
    name: string;
  };

  objectiveLabel: string;
  geographyLabel: string;

  status:
    | "draft"
    | "building_strategy"
    | "strategy_ready"
    | "discovering"
    | "researching"
    | "comparing"
    | "ready_for_review"
    | "paused"
    | "needs_attention"
    | "completed"
    | "cancelled"
    | "archived";

  currentStageLabel?: string;

  counts: {
    recommended: number;
    conditional: number;
    needsResearch: number;
    approved: number;
  };

  lastActivityAt: string;
  owner?: UserSummaryView;
  primaryAction: CampaignActionView;
};
```

### 46.2 Candidate row

```ts
type CandidateRowView = {
  campaignCandidateId: string;
  canonicalOrganizationId: string;

  company: {
    name: string;
    domain?: string;
    logoUrl?: string;
    country?: string;
    locality?: string;
    parentName?: string;
    relationBadge?: "parent" | "subsidiary" | "branch" | "storefront";
  };

  relationship: RelationshipType;
  eligibility: CandidateEligibility;
  queue: CandidateQueue;
  matchedArchetypeLabel?: string;

  scores: {
    fit?: number;
    potentialBand?: "low" | "medium" | "high" | "strategic";
    confidence?: number;
    comparativeRank?: number;
  };

  strongestEvidence?: string;
  primaryRisk?: string;

  evaluationState:
    | "not_started"
    | "researching"
    | "evaluated"
    | "ranking_pending"
    | "final"
    | "stale"
    | "failed";

  userDecision?: "approved" | "conditionally_approved" | "rejected" | "excluded";

  contactState?:
    | "not_started"
    | "queued"
    | "searching"
    | "found"
    | "partial"
    | "none_found"
    | "failed";

  availableActions: CandidateActionView[];
};
```

### 46.3 Campaign progress

```ts
type CampaignProgressView = {
  campaignId: string;
  status: string;
  currentStage: string;
  currentStageLabel: string;

  stages: Array<{
    key: string;
    label: string;
    state:
      | "waiting"
      | "running"
      | "partial"
      | "complete"
      | "skipped"
      | "blocked"
      | "failed";
    completedAt?: string;
    detail?: string;
  }>;

  counters: {
    sourceRecords: number;
    canonicalCompanies: number;
    duplicatesMerged: number;
    prefilteredOut: number;
    underResearch: number;
    evaluated: number;
    recommended: number;
    conditional: number;
    needsResearch: number;
    excluded: number;
    invalid: number;
  };

  currentActivity?: string;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
};
```

### 46.4 Rule display

```ts
type RuleView = {
  id: string;
  statement: string;
  type: "requirement" | "preference" | "signal" | "exclusion";
  strength: "hard" | "soft";
  scope: "workspace" | "offering" | "campaign" | "candidate";
  applicabilityLabel: string;
  status: "proposed" | "provisional" | "confirmed" | "rejected" | "superseded";
  originLabel: string;
  canEditScope: boolean;
};
```

### 46.5 Evidence item

```ts
type EvidenceItemView = {
  id: string;
  sourceLabel: string;
  sourceType: string;
  sourceUrl?: string;
  retrievedAt: string;
  excerpt?: string;
  structuredValue?: unknown;
  reliability: "low" | "medium" | "high";
  freshness: "current" | "aging" | "stale" | "unknown";
  supports: string[];
  contradicts: string[];
};
```

### 46.6 Action contract

UI mutations should return:

```ts
type MutationResult<T> = {
  success: boolean;
  data?: T;
  commandId?: string;
  workflowRunId?: string;
  affectedSubjects?: Array<{
    type: string;
    id: string;
  }>;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
};
```

This supports asynchronous follow-up and optimistic UI only where safe.

---

## 47. Optimistic UI Rules

### 47.1 Safe optimistic actions

May update immediately with undo:

- simple queue move;
- campaign-scoped reject;
- candidate approval;
- adding a comment;
- changing a personal table preference.

### 47.2 Non-optimistic actions

Wait for server confirmation:

- publishing profile;
- confirming strategy;
- broad-scope rule creation;
- entity merge or split;
- starting paid enrichment;
- bulk re-evaluation;
- deleting campaign;
- memory promotion;
- changing immutable version references.

### 47.3 Background recomputation

When an action triggers recomputation:

- update the direct user decision immediately if confirmed;
- mark derived evaluation as `Updating`;
- preserve prior result until new result is ready;
- prevent contradictory downstream actions if necessary.

---

## 48. Performance Requirements

### 48.1 Initial page load

The main shell and cached campaign summary should render quickly without waiting for full evidence payloads.

### 48.2 Candidate table

Support large candidate sets through:

- server-side pagination or virtualization;
- indexed filters;
- stable sorting;
- incremental count updates;
- no full evidence hydration for every row.

### 48.3 Candidate detail

Load summary and evaluation first, then evidence and history progressively.

### 48.4 Realtime updates

Use subscriptions, polling, or event-driven refresh to update:

- campaign stage;
- counters;
- candidate state;
- notifications;
- research completion.

Avoid refetching the entire campaign on every task event.

### 48.5 Stale-while-revalidate

Where safe, display cached data with an update indicator.

---

## 49. Security and Privacy in the Interface

### 49.1 Workspace isolation

All routes and view models must be checked against active workspace membership.

### 49.2 Source visibility

Do not expose provider credentials, internal API payloads, or restricted data-license details.

### 49.3 Contact data

Contact information should be visible only to authorized workspace members.

### 49.4 Audit visibility

Users may see who made a decision, but sensitive internal technical logs should remain restricted.

### 49.5 Free text

Warn users not to paste unnecessary sensitive personal information into campaign instructions or comments.

---

## 50. Key End-to-End User Journeys

### 50.1 First-time company setup

1. User opens Company Profile.
2. User enters website.
3. Opptium analyzes sources.
4. User reviews business model and offerings.
5. User answers only high-impact questions.
6. User corrects assumptions.
7. User publishes profile.
8. Primary action becomes `Create campaign`.

Success condition:

- a published profile contains enough commercial intelligence to compile a campaign strategy.

### 50.2 First campaign

1. User clicks New campaign.
2. User selects geography.
3. Opptium proposes objective and offering.
4. Opptium proposes target hypothesis.
5. User adjusts constraints and campaign exclusions.
6. User builds market strategy.
7. User reviews market brief, archetypes, qualification, exclusions, and discovery plan.
8. User confirms strategy.
9. Discovery begins.

Success condition:

- discovery references an immutable strategy that the user understood and confirmed.

### 50.3 Running discovery

1. User views current segment and coverage.
2. Partial candidates appear as provisional.
3. Duplicate counts and downstream stages update.
4. System identifies a geographic gap.
5. A targeted pass runs with an explicit reason.
6. Comparative ranking completes.
7. User receives notification.

Success condition:

- each pass builds on campaign memory and users can explain why the campaign is still running.

### 50.4 Candidate review and correction

1. User opens Recommended.
2. User expands a candidate.
3. User sees strong fit but uncertain procurement autonomy.
4. User requests targeted research.
5. New evidence arrives.
6. Candidate is re-evaluated.
7. User approves conditionally.
8. Condition carries into contact role selection.

Success condition:

- user decision, evidence, recomputation, and downstream conditions remain traceable.

### 50.5 Campaign-specific exclusion

1. User identifies agencies in a direct-buyer campaign.
2. User selects `Exclude`.
3. Default scope is This campaign.
4. User confirms reason.
5. Existing matching candidates are reclassified.
6. Later discovery stops returning agencies as buyers.
7. The correction remains provisional outside this campaign.

Success condition:

- campaign behavior improves without creating an unintended global rule.

### 50.6 Memory promotion

1. Same exclusion is used in several campaigns for one offering.
2. Opptium suggests offering-level promotion.
3. User reviews applicability conditions.
4. User confirms.
5. A new profile draft or offering-memory rule is created.
6. Future strategies propose the rule.

Success condition:

- broader learning is deliberate and auditable.

### 50.7 Entity correction

1. User notices two country storefronts represent one buying organization.
2. User opens duplicate review.
3. User confirms merge.
4. Candidate rows consolidate.
5. Evaluation recalculates at buying-organization level.
6. Contact enrichment targets the correct parent or procurement entity.

Success condition:

- identity correction does not lose evidence or history.

### 50.8 Approved companies to contacts

1. User approves selected companies.
2. Opptium proposes target roles.
3. User adjusts roles.
4. Usage estimate is shown.
5. User starts contact enrichment.
6. Contacts appear in Leads.
7. User selects contacts and creates a sequence draft.

Success condition:

- contact spend occurs only after company qualification and uses campaign context.

---

## 51. Product Acceptance Criteria

### 51.1 Company Profile

- User can create a profile from a website without manually filling a full ICP form.
- Business model, offerings, commercial mechanics, and buyer logic are shown separately.
- Every material claim has a visible status and accessible evidence.
- Clarification questions explain why they matter and can usually be skipped.
- User can edit and publish an immutable profile version.
- Profile-level and offering-level rules show scope and applicability.

### 51.2 Campaign setup

- Geography is the first campaign input.
- Objective and offering are proposed by the system and editable.
- Target hypothesis is AI-generated from Company Intelligence.
- Campaign exclusions default to campaign scope.
- User can provide natural-language corrections and review structured interpretation.
- Campaign setup autosaves and can be resumed.

### 51.3 Strategy review

- Discovery cannot start before strategy confirmation.
- User can see market brief, archetypes, qualification logic, exclusions, assumptions, and source plan.
- Exclusion scope and applicability are visible.
- Strategy confirmation creates an immutable version.
- Strategy revisions show impact and affected candidates.

### 51.4 Discovery

- Progress is shown by purposeful stages and coverage, not only fixed iterations.
- Counters have unambiguous definitions.
- Coverage is visible by archetype and geography.
- Additional passes have a stated reason.
- Partial results are marked provisional.
- Campaign can pause, resume, cancel, and recover without losing completed work.

### 51.5 Results

- Recommended, conditional, needs-research, rejected, excluded, and invalid/duplicate queues are separate.
- Tables are compact and expandable.
- Relationship, eligibility, fit, potential, and confidence are separate.
- Strongest evidence is visible in the row.
- Candidate detail includes evidence, factor breakdown, identity, procurement, and audit context.
- Unknown evidence is distinct from negative evidence.

### 51.6 Corrections and memory

- User can correct relationship, archetype, entity, evidence, and procurement logic.
- Corrections apply immediately at the selected safe scope.
- Campaign corrections do not silently become global.
- Promotion to offering or workspace scope requires confirmation.
- Conflicting broad and specific rules are displayed and resolved by applicability.

### 51.7 Handoff

- Company approval is separate from contact enrichment.
- Relevant buying roles are proposed before contact search.
- Credit estimate appears before paid enrichment.
- Leads are available in a flattened contact view with company context.
- Sequence generation uses approved campaign and candidate evidence.

### 51.8 Accessibility and quality

- Core workflows support keyboard navigation.
- Status does not rely only on color.
- Long-running operations remain understandable after navigation away and return.
- Mobile remains functional for status and simple review.
- Tables support large result sets without loading all evidence per row.

---

## 52. Implementation Sequence

### Phase 1 — Shared shell and route states

Implement:

- navigation order;
- active company context;
- campaign route structure;
- campaign status model;
- async notification foundation;
- view-model boundary.

### Phase 2 — Company Profile V2 UI

Implement:

- website ingestion screen;
- analysis progress;
- structured profile sections;
- offering detail;
- claim and evidence states;
- clarification questions;
- profile editing;
- publish and version history.

### Phase 3 — Campaign setup and strategy review

Implement:

- geography-first setup;
- objective and offering proposal;
- target hypothesis editor;
- constraint and exclusion controls;
- natural-language interpretation preview;
- strategy compilation progress;
- strategy review and confirmation;
- revision diff and impact preview.

### Phase 4 — Discovery progress

Implement:

- stage timeline;
- canonical counters;
- coverage matrix;
- active segment explanation;
- pause, resume, cancel;
- partial result states;
- campaign activity feed.

### Phase 5 — Results and candidate detail

Implement:

- queue tabs;
- compact table;
- filters and sorting;
- row expansion or side panel;
- factor evidence;
- fit, potential, confidence;
- identity and procurement sections;
- approve, reject, exclude, and research actions.

### Phase 6 — Corrections, memory, and entity review

Implement:

- scope selector;
- campaign decisions panel;
- provisional learning;
- promotion suggestions;
- rule conflict presentation;
- duplicate merge review;
- split workflow;
- evaluation updates after correction.

### Phase 7 — Approval, contacts, and leads handoff

Implement:

- approved-company queue;
- buying-role proposal;
- enrichment estimate and controls;
- contact progress;
- Leads flattened list;
- sequence handoff context.

### Phase 8 — Collaboration, analytics, and polish

Implement:

- comments;
- reviewer ownership;
- saved views;
- email notifications;
- telemetry;
- accessibility audit;
- responsive polish;
- internal benchmark comparison UI.

---

## 53. Non-Negotiable Interface Rules

1. Do not ask the user to define the company and ICP manually when the website can be analyzed first.
2. Do not start discovery before the user confirms a strategy version.
3. Do not present a generic market category as a complete target definition.
4. Do not show one opaque fit score as the candidate decision.
5. Do not mix recommended companies, competitors, invalid records, and duplicates in one review queue.
6. Do not treat unknown evidence as a confirmed negative.
7. Do not silently turn campaign corrections into workspace-wide exclusions.
8. Do not expose localized storefront duplicates as independent buying organizations when they resolve to one parent.
9. Do not spend contact-enrichment credits before company qualification by default.
10. Do not hide why another discovery pass is running.
11. Do not use raw provider records as the user-facing company identity.
12. Do not mutate published profile or strategy versions in place.
13. Do not make the interface chat-only; combine structured controls with natural-language assistance.
14. Do not make result rows tall because explanations are embedded directly in the table.
15. Do not expose internal task names as primary user language.
16. Do not imply that discovered volume equals qualified market size.
17. Do not remove audit history when the user changes a decision.
18. Do not allow a broad rule change without showing scope and impact.
19. Do not send speculative AI assumptions into outbound messaging as facts.
20. Do not require the user to remain on the page while long-running work completes.

---

## 54. Final Product Flow

The complete Intelligence V2 experience is:

```text
Company website and materials
        ↓
AI builds structured Company Intelligence
        ↓
User confirms business model, offerings, and important assumptions
        ↓
Published Company Profile version
        ↓
User selects geography
        ↓
AI proposes objective, offering, and target hypothesis
        ↓
User adjusts campaign constraints and scoped exclusions
        ↓
AI builds a market-specific strategy
        ↓
User reviews archetypes, qualification, exclusions, assumptions, and source plan
        ↓
Confirmed Campaign Strategy version
        ↓
Coverage-driven provider-independent discovery
        ↓
Entity resolution and canonical companies
        ↓
Evidence-based research and deterministic qualification
        ↓
Comparative ranking and consistency checks
        ↓
Recommended, conditional, research, rejected, excluded, and data-quality queues
        ↓
User corrections with controlled memory scope
        ↓
Approved companies
        ↓
Role selection and contact enrichment
        ↓
Leads and sequence preparation
```

The interface must preserve this dependency chain. Skipping earlier reasoning stages for speed will recreate the same failure Intelligence V2 is intended to solve.

---

## 55. Completion Definition

Document 07 is considered implemented when a user can move from an unconfigured workspace to an approved set of companies while:

- understanding what Opptium inferred about their business;
- confirming the commercial logic of a campaign;
- seeing purposeful discovery progress;
- inspecting evidence behind every recommendation;
- correcting mistakes without creating unintended global rules;
- preserving campaign-specific learning;
- resolving duplicates and buying organizations;
- approving companies before contact enrichment;
- handing qualified context into Leads and Sequences;
- returning later without losing workflow state or explanation.

At that point, the interface is not merely displaying AI output. It is operating as the transparent, controllable product layer for Opptium’s commercial intelligence system.

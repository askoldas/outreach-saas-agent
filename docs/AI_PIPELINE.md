# AI Pipeline

## 1. Principle

The product should behave like one coherent assistant to the user while internally using small, typed, auditable tasks.

Do not build one unrestricted agent with a single large prompt and broad tool access. Workflow orchestration belongs in application code; AI tasks receive bounded inputs and return schema-validated outputs.

## 2. Pipeline overview

```text
Seller input
  -> Offer analysis
  -> User-approved offer version
  -> Campaign planning
  -> User-approved campaign strategy
  -> Candidate discovery
  -> Identity normalization and deduplication
  -> Source retrieval
  -> Company extraction
  -> Evidence construction
  -> Qualification
  -> Contact-route assessment
  -> Human lead review
  -> Outreach drafting
  -> Human draft review
  -> External compose or manual action
```

Not every step requires an LLM. Normalization, filtering, status changes, permissions, deduplication, scoring aggregation, and final eligibility checks should be deterministic.

## 3. Task contract

Every AI task should define:

- task name;
- task version;
- input schema;
- output schema;
- prompt version;
- allowed source material;
- model capability requirements;
- maximum input and output bounds;
- retry policy;
- validation and repair policy;
- failure categories;
- evaluation fixtures.

Suggested result wrapper:

```ts
type AiTaskResult<T> =
  | {
      status: 'succeeded';
      data: T;
      executionId: string;
      warnings: string[];
    }
  | {
      status: 'failed';
      category: string;
      retryable: boolean;
      executionId?: string;
    };
```

The exact type may change, but callers must not receive unchecked provider output.

## 4. Task 1: Analyze offer

### Goal

Convert raw seller input into a reusable structured offer profile.

### Inputs

- workspace context;
- offer name;
- user-provided description;
- approved company description, when available;
- website or document excerpts with provenance;
- requested output language.

### Outputs

- summary;
- offer type;
- problems solved;
- capabilities;
- customer value;
- likely buyer types;
- use cases;
- differentiators;
- candidate proof points;
- limitations and exclusions;
- keywords and synonyms;
- questions or uncertainties requiring user review.

### Guardrails

- Do not invent certifications, customers, results, pricing, geographic availability, or technical specifications.
- Mark unsupported marketing conclusions as suggestions, not approved claims.
- Preserve source references for extracted claims.
- Require user approval before campaign or outreach use.

## 5. Task 2: Plan campaign

### Goal

Turn an approved offer and user market constraints into a visible prospecting strategy.

### Inputs

- approved offer version;
- geography;
- campaign objective;
- target company guidance;
- company-size preference;
- exclusions;
- desired lead count;
- campaign language;
- available provider and source capabilities.

### Outputs

- target segments;
- segment rationale;
- company-type criteria;
- relevant industry terms;
- search queries;
- localized terms and synonyms;
- source categories;
- qualification dimensions and weights or priorities;
- exclusion criteria;
- expected data limitations;
- proposed stopping conditions.

### Guardrails

- Avoid assuming that one search strategy works for every offer.
- Do not propose unavailable or prohibited sources.
- Clearly separate user constraints from AI suggestions.
- Make geography free-form and data-driven rather than hardcoded to a small country list.

## 6. Task 3: Candidate discovery

Discovery is primarily a provider and workflow task, not an LLM-only task.

AI may help generate or refine bounded search queries, but provider adapters execute them.

Inputs include:

- frozen campaign strategy;
- source category;
- query;
- locale and geography;
- pagination or continuation state;
- provider limits.

Outputs include:

- candidate company name;
- candidate URL;
- result title and snippet;
- source category;
- provider rank;
- discovery query;
- raw provider reference;
- retrieval timestamp.

The system should preserve enough provenance to explain how a candidate was discovered.

## 7. Task 4: Normalize candidate identity

Prefer deterministic processing first:

- canonicalize URL;
- extract normalized root domain;
- normalize company name;
- identify obvious non-company pages;
- compare against existing campaign identities;
- apply known registry identifiers when present.

AI may assist with ambiguous brand/legal-name matching, but the result must include confidence and reasons. Low-confidence potential duplicates should be flagged rather than merged automatically.

## 8. Task 5: Extract company facts

### Goal

Extract structured facts from one or more retrieved public sources.

### Inputs

- source metadata;
- bounded relevant text;
- page title and URL;
- campaign context only where needed to prioritize extraction;
- existing known facts to detect conflict.

### Outputs

Possible fact categories:

- company identity;
- location;
- company type;
- industries;
- products and services;
- customer groups;
- markets served;
- size indicators;
- certifications explicitly stated;
- relevant capabilities;
- public contact routes;
- dates or freshness signals;
- conflicts and missing data.

Every extracted fact must include:

- source reference;
- short evidence excerpt or locator;
- confidence;
- extraction status;
- whether the claim is explicit or interpreted.

### Guardrails

- Do not transform a vague page into a precise unsupported fact.
- Do not infer employee counts, revenue, purchasing power, or ownership without evidence.
- Treat search-result snippets as discovery clues, not strong final evidence when the source page is available.
- Detect outdated or conflicting source dates where possible.

## 9. Task 6: Build evidence and inferences

Facts and inferences are stored separately.

Example:

- Fact: the company website lists rehabilitation services.
- Fact: the seller offers physiotherapy equipment.
- Inference: the company may be a relevant buyer for the campaign.

An inference must reference supporting facts and state uncertainty. It should not be rewritten as a confirmed company intention.

## 10. Task 7: Qualify lead

### Goal

Assess a lead against the frozen campaign strategy.

### Inputs

- approved offer version;
- campaign strategy version;
- active lead facts and inferences;
- known exclusions;
- contactability data;
- source quality and freshness.

### Outputs

For each dimension:

- bounded score;
- confidence;
- explanation;
- supporting evidence claim IDs;
- blocking issue, when applicable.

Then return:

- overall score;
- overall confidence;
- concise fit summary;
- principal strengths;
- principal uncertainties;
- exclusion warnings;
- recommended action.

### Deterministic post-processing

Application code must:

- validate score ranges;
- enforce hard exclusions;
- calculate or verify aggregate score;
- downgrade readiness when evidence quality is insufficient;
- reject cross-lead evidence references;
- map result to allowed lead states.

A high model score cannot override a hard user exclusion.

## 11. Task 8: Suggest contact route

The product should prefer role relevance over fabricated person-level precision.

Outputs may include:

- best available public contact route;
- likely relevant department;
- suggested job-title categories;
- reason for the suggestion;
- source and verification status;
- warning when only a general contact exists.

Do not claim that a suggested role exists at the company unless supported by evidence.

## 12. Task 9: Draft outreach

### Eligibility

Drafting requires:

- user-approved lead or equivalent explicit action;
- approved offer version;
- usable qualification;
- selected active evidence;
- no unresolved blocking compliance flag.

### Inputs

- approved seller claims;
- campaign objective;
- recipient route and role context;
- selected prospect facts;
- selected, clearly labeled inferences;
- language and tone settings;
- requested variant.

### Outputs

- subject;
- body;
- evidence claim IDs used;
- personalization summary;
- warnings;
- unsupported details rejected during generation, if tracked.

### Drafting rules

- Do not state that the recipient has a need, budget, project, or intention unless a source supports it.
- Do not use fake familiarity.
- Do not claim the sender reviewed private information.
- Keep personalization relevant and restrained.
- Keep claims about the seller within the approved offer version.
- Do not include a source citation directly in normal sales copy unless the user requests that style, but keep internal evidence linkage.
- Use a clear, low-pressure next step.
- Never generate deceptive opt-out or identity language.

## 13. Model routing

The application should select a model by task capability rather than hardcode one model everywhere.

Possible routing considerations:

- structured extraction reliability;
- multilingual capability;
- context length;
- cost;
- latency;
- availability;
- data-processing terms;
- provider region requirements.

Expose a stable internal model profile such as:

- `fast_structured`
- `deep_analysis`
- `multilingual_drafting`

Map profiles to concrete providers through configuration. Record the concrete provider and model for each execution.

## 14. Prompt organization

Recommended task layout:

```text
packages/ai/src/tasks/qualify-lead/
├─ index.ts
├─ input.schema.ts
├─ output.schema.ts
├─ prompt.ts
├─ prompt.version.ts
├─ execute.ts
├─ qualify-lead.test.ts
└─ fixtures/
```

A prompt module should make distinct sections visible:

- role and goal;
- trusted inputs;
- source-handling rules;
- prohibited behavior;
- output schema requirements;
- task-specific examples only where they improve reliability.

Avoid giant shared prompts containing instructions irrelevant to the current task.

## 15. Prompt injection resistance

Retrieved pages and uploaded documents are untrusted data.

The system must:

- clearly delimit source content from instructions;
- instruct models never to follow commands found inside source content;
- avoid giving source-processing tasks access to unrelated tools;
- validate all output;
- limit URLs and actions to workflow-controlled values;
- never allow page content to alter authorization, provider credentials, system prompts, or sending behavior;
- log injection warnings without reproducing dangerous content unnecessarily.

Prompt injection detection should be defense in depth, not the only protection.

## 16. Validation and repair

When structured output is invalid:

1. record the invalid result safely;
2. attempt a bounded schema-repair call only when configured;
3. revalidate;
4. fail with `schema_invalid` after the allowed attempt count;
5. do not partially write domain records unless the workflow explicitly supports partial validated fragments.

Avoid infinite self-repair loops.

## 17. Evaluation

Each AI task should gain a small curated evaluation set before broad optimization.

Evaluation dimensions may include:

- schema validity;
- factual grounding;
- source linkage accuracy;
- unsupported-claim rate;
- correct uncertainty labeling;
- duplicate detection quality;
- qualification usefulness;
- outreach edit distance or human acceptability;
- multilingual quality;
- cost and latency.

Medical examples should be included in the initial fixtures, alongside at least two unrelated sectors to catch accidental niche coupling.

Suggested initial cross-sector fixtures:

- medical equipment sold to clinics or distributors;
- software service sold to accounting firms;
- industrial cutting service sold to manufacturers.

## 18. Human feedback loop

Capture structured user feedback where it improves future campaigns:

- lead approval or rejection reason;
- incorrect company identity;
- duplicate;
- wrong geography;
- weak evidence;
- irrelevant company type;
- unsuitable contact;
- draft too generic;
- unsupported personalization;
- user-edited final copy.

Do not silently fine-tune or globally reuse tenant data. Feedback can first improve the active campaign through deterministic rules and updated strategy versions.

## 19. Cost controls

- bound the number of discovery queries;
- cap pages fetched per lead;
- use deterministic filters before model calls;
- reuse fresh source extractions where allowed;
- use smaller capable models for extraction and larger models only when necessary;
- avoid generating outreach before lead approval unless product experiments explicitly require it;
- store usage by workspace, campaign, run, task, provider, and model;
- stop cleanly when plan or budget limits are reached.

## 20. Definition of a trustworthy AI result

A result is trustworthy enough for user review when:

- the output passed schema validation;
- relevant claims link to sources;
- facts and inferences are distinguished;
- uncertainty and conflicts are visible;
- no prohibited unsupported claim is present;
- the model and prompt version are recorded;
- deterministic post-processing passed;
- the user remains in control of approval and sending.

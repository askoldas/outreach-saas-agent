# AI Lead Evaluation

Lead evaluation is the qualification stage of Trigger.dev Campaign discovery.

## Purpose

The evaluator decides whether a Tavily-discovered source is likely to represent
a useful B2B lead for the selected campaign and frozen Company Profile. It does not draft
outreach, send email, invent private contacts, or bypass human review.

## Trigger Flow

1. `search_web` builds horizontal Campaign Strategy and Company Profile-aware queries.
2. Tavily results are saved to canonical `company_sources`.
3. General source classification marks each result as company website,
   contact page, directory, association, registry, marketplace, job posting,
   article/news, social profile, irrelevant, or unknown.
4. Plausible sources create canonical companies and Campaign associations.
5. The discovery service calls OpenRouter and requires strict JSON.
6. Evaluations persist immutable qualification results, dimensions, and evidence.
7. Failed AI evaluations preserve a needs-review Campaign company with
   `insufficient_evidence` status.
8. Every attempt is audited in `ai_requests`.
9. Contact enrichment remains an explicit post-approval Trigger task.

## Prompt Version

Current prompt version:

```ts
lead - evaluator - v1;
```

Every OpenRouter call writes an `ai_requests` row with provider, selected model,
fallback state, prompt/schema version, token/cost metadata, status, and error details.

## Output Schema

The model must return strict JSON matching the lead evaluator schema:

```ts
{
  companyName: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  companyType: string | null;
  industry: string | null;
  relevanceScore: number;
  confidence: "low" | "medium" | "high";
  qualificationStatus: "qualified" | "needs_review" | "disqualified";
  fitReasons: string[];
  disqualifyingSignals: string[];
  missingInfo: string[];
  contactability: "low" | "medium" | "high";
  suggestedNextAction: string;
  summary: string;
}
```

Invalid JSON or missing required fields preserve the candidate for manual review.

## Rules

- Use only supplied frozen campaign, Company Profile, and source evidence.
- Do not invent emails, people, private data, or unsupported facts.
- Be conservative with scores and confidence.
- Ambiguous leads should be `needs_review`.
- Irrelevant sources should be `disqualified`.
- Human review remains required before outreach.

## Contact Enrichment

Contact enrichment is provider-backed, evidence-based, and separate from AI
qualification. The Trigger service performs a company-domain-scoped Tavily search and
parses provider results, saved evidence, and shallow public website/contact-page
checks deterministically. Provider-derived routes retain the query, source URL,
source title, provider, and verification timestamp.

Manual check strings:

```txt
e-mail: direzione@farmaciaassistita.it
Tel: 06.596.33.107
Numero Verde 800.171.651
```

Expected result: the email is saved as an `Email` contact, both numbers are
saved as `Phone` contacts, and lead contactability increases from `low` to
`medium` or `high` depending on the number of source-confirmed routes.

## Current Limitations

- Evaluation depends on Tavily result snippets and source URLs.
- Deep website crawling is not implemented.
- Contact enrichment is a separate Trigger task and does not invent emails or
  people.
- Outreach drafting is handled by a separate grounded durable task after approval.

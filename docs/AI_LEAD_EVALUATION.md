# AI Lead Evaluation

Lead evaluation is the first AI task in the background worker pipeline.

## Purpose

The evaluator decides whether a Tavily-discovered source is likely to represent
a useful B2B lead for the selected campaign and offer. It does not draft
outreach, send email, invent private contacts, or bypass human review.

## Worker Flow

1. `search_web` builds horizontal campaign/offer-aware queries.
2. Tavily results are saved to `lead_sources`.
3. General source classification marks each result as company website,
   contact page, directory, association, registry, marketplace, job posting,
   article/news, social profile, irrelevant, or unknown.
4. Plausible candidate sources get `evaluate_lead` tasks.
5. `evaluate_lead` calls OpenRouter and requires strict JSON.
6. Valid `qualified` or `needs_review` evaluations create or update leads.
7. Failed AI evaluations still create a needs-review lead with
   `qualification_status = failed` so discovery is not blocked by OpenRouter.
8. `disqualified` evaluations remain in `lead_sources` and `ai_generations`.
9. Saved leads receive a deterministic `enrich_contacts` task.

## Prompt Version

Current prompt version:

```ts
lead-evaluator-v1
```

Every OpenRouter call writes an `ai_generations` row with provider, model, task
name, prompt version, input JSON, output text/JSON when successful, error
message when failed, workspace id, run id, and task id.

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

Invalid JSON or missing required fields fails the task so the worker retry policy
can handle it.

## Rules

- Use only supplied campaign, offer, and source evidence.
- Do not invent emails, people, private data, or unsupported facts.
- Be conservative with scores and confidence.
- Ambiguous leads should be `needs_review`.
- Irrelevant sources should be `disqualified`.
- Human review remains required before outreach.

## Contact Enrichment

Contact enrichment is deterministic, evidence-based, and separate from AI
qualification. The worker parses saved Tavily title, URL, query, and content
before any website request. It extracts only public routes that appear in source
evidence or shallow public website/contact-page checks.

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
- Deep website crawling is not yet a worker task.
- Contact enrichment is a separate worker task and does not invent emails or
  people.
- Outreach drafting remains deferred.

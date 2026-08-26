# Core Intelligence compatibility audit

## Canonical runtime lineage

For newly bound Qualification work, the runtime lineage is:

`Company Intelligence -> Commercial Relationship assessment -> Qualification evaluation -> Ranking snapshot -> Campaign result`

The Qualification member and evaluation both store the exact Company Intelligence and
Commercial Relationship assessment identifiers. Workers load Company Intelligence directly by
that frozen identifier. Ranking consumes only frozen Qualification output and remains model-free.

## Intentionally retained legacy compatibility

- Candidate Research continues to publish `candidate_intelligence_versions`. It is the current
  evidence-backed source adapter used to compile immutable Company Intelligence.
- Company Intelligence retains `source_candidate_intelligence_version_id` for reproducibility and
  source auditing.
- Qualification batch initialization retains the legacy Candidate Intelligence identifier because
  existing database contracts require it and historical batches predate direct Company
  Intelligence binding.
- Qualification workers use legacy source lookup only when a historical member has no direct
  Company Intelligence binding.
- Campaign Results retain the legacy version identifier and legacy unresolved-question read for
  historical evaluations. New results expose direct Company Intelligence lineage.

These reads are compatibility boundaries, not alternate canonical decision paths. They must not
override a direct Core Intelligence binding or mutate historical artifacts.

## Cross-stage invariants

- A Commercial Relationship assessment must reference one exact Company Intelligence version.
- A new Qualification member and its pending evaluation must bind the same Company Intelligence
  and Commercial Relationship assessment versions.
- A bound worker must load Company Intelligence by its direct version identifier.
- A correction proposal must reference the assessment used by the frozen evaluation.
- Ranking must not load Company Intelligence, call a model, or reinterpret relationship evidence.
- Campaign Results may fall back only for nullable historical lineage.

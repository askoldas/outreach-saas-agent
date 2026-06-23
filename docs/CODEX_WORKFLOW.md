# Codex Workflow

## 1. Purpose

This repository is intended to be developed through small, well-scoped Codex tasks with human review.

Codex should be treated as an implementation agent working inside defined product and architecture contracts, not as the place where major product decisions are silently invented.

## 2. Source-of-truth order

Before implementing a task, Codex should inspect:

1. the task or issue description;
2. the nearest applicable `AGENTS.md` file;
3. accepted decisions in `docs/DECISIONS.md`;
4. the relevant product, architecture, domain, AI, security, and testing documentation;
5. existing implementation and tests.

When these conflict, the task should preserve accepted decisions and working secure behavior, then report the conflict rather than hiding it.

## 3. Recommended task size

A good Codex task normally changes one coherent behavior, such as:

- add workspace and membership migrations with RLS tests;
- implement URL normalization and unit tests;
- scaffold one package and its build configuration;
- add the offer-version approval transition;
- implement one provider adapter behind an existing interface;
- add one dashboard page backed by an existing service;
- fix one workflow retry bug.

Avoid prompts such as:

- build the entire SaaS;
- add authentication, campaigns, search, AI, and billing;
- refactor the whole architecture;
- make the UI professional;
- implement all agents.

Large tasks increase assumptions, unrelated changes, and unverifiable claims.

## 4. Task specification template

Use this structure when creating a Codex task or GitHub issue:

```md
## Goal

Describe the user-visible or architectural outcome.

## Context

List the relevant files, milestone, accepted decisions, and current behavior.

## Scope

- required change 1
- required change 2
- required change 3

## Out of scope

- explicitly excluded item 1
- explicitly excluded item 2

## Acceptance criteria

- [ ] objective observable result
- [ ] relevant authorization behavior
- [ ] relevant test expectation
- [ ] documentation updated when required

## Constraints

- preserve tenant isolation
- no unrelated refactors
- no new provider dependency unless requested
- follow repository `AGENTS.md`

## Verification

List expected commands only when they actually exist in the repository.
```

## 5. Example: implementation task

```md
## Goal

Create one focused screen or interaction inside the root Next.js prototype.

## Context

Follow `AGENTS.md`, `docs/REPOSITORY_STRUCTURE.md`, `docs/ROADMAP.md`, and accepted decisions D-001, D-002, D-004, and D-017.

## Scope

- add or refine the requested route under `src/app`;
- keep large mock data in `src/data/mock`;
- use feature folders for screen-specific components;
- preserve human review before outreach;
- update docs when structure or commands change.

## Out of scope

- authentication;
- Supabase;
- AI or search providers;
- queue or worker infrastructure;
- automatic sending;
- real persistence.

## Acceptance criteria

- [ ] screen renders with realistic fictional data;
- [ ] layout works on desktop and mobile;
- [ ] no medical-only assumptions appear;
- [ ] lint, type check, and build pass;
- [ ] documentation matches the implemented structure.

## Constraints

- keep dependencies minimal;
- do not add `apps/`, `packages/`, `workers/`, Turborepo, Supabase, provider SDKs, or future API routes;
- do not imply backend behavior works when it is mock-only.
```

## 6. Codex execution expectations

Codex should:

1. inspect the current repository before proposing changes;
2. identify relevant instructions and decisions;
3. make a concise implementation plan for multi-file work;
4. avoid asking questions that can be resolved safely from repository context;
5. state material assumptions when requirements remain incomplete;
6. implement a minimal coherent diff;
7. add or update tests;
8. run available checks;
9. inspect its own diff for unrelated changes;
10. update documentation and decision records when contracts change;
11. provide an accurate completion summary.

## 7. Assumptions

When a task is underspecified, Codex may make a conservative assumption when:

- it does not change an accepted product boundary;
- it does not weaken security or tenant isolation;
- it does not add an irreversible dependency;
- it does not trigger sending, billing, deletion, or external side effects;
- the assumption is documented in the completion report.

Codex should not invent:

- credentials;
- production URLs;
- real company or contact data;
- legal conclusions;
- unapproved architecture decisions;
- successful test results;
- external provider capabilities not verified by implementation or documentation.

## 8. Branch and commit guidance

Recommended branch names:

- `feat/<short-scope>`
- `fix/<short-scope>`
- `docs/<short-scope>`
- `refactor/<short-scope>`
- `chore/<short-scope>`

Prefer commits that describe the delivered outcome:

- `feat: add workspace membership policies`
- `fix: prevent duplicate leads on discovery retry`
- `docs: record durable job provider decision`
- `test: cover cross-workspace lead access`

Do not split every created file into a separate commit unless the repository tooling forces that during bootstrap. Once normal Git access is available, keep commits logically grouped.

## 9. Pull request structure

A pull request should include:

```md
## Summary

- main change
- supporting change

## Why

Explain the product, correctness, security, or maintainability reason.

## Verification

- `command` - result
- manual check - result

## Data and configuration

- migrations:
- environment variables:
- provider changes:

## Risks and follow-up

- known limitation or `None`
```

Screenshots are useful for meaningful UI changes but do not replace behavior tests.

## 10. Review checklist

Before merging, confirm:

- the change matches the issue scope;
- accepted decisions remain intact;
- shared code is not medical-specific;
- workspace ownership is preserved;
- server authorization exists for mutations;
- long work is not hidden in a web request;
- external providers remain behind adapters;
- AI output is validated;
- evidence and inference remain distinct;
- no automatic sending was introduced;
- migrations are append-only;
- tests assert meaningful behavior;
- environment variables are documented;
- no secrets or real customer data are committed;
- docs match the implementation;
- completion claims match checks actually run.

## 11. Working with failures

When checks fail, Codex should:

1. report the exact failing command and relevant error;
2. determine whether the failure is caused by the change, environment, or pre-existing state;
3. fix task-related failures when possible;
4. avoid weakening tests or removing checks solely to obtain green status;
5. document unresolved environmental blockers clearly.

Do not label a task complete when a required acceptance criterion is known to be unmet.

## 12. Decision changes

When implementation reveals that a proposed decision must be accepted or rejected:

- update `docs/DECISIONS.md` in the same pull request;
- record alternatives considered;
- explain consequences;
- update related architecture or setup documentation;
- keep provider-specific choices out of shared domain code.

When changing an accepted decision, create a superseding entry rather than rewriting the old decision as though it never existed.

## 13. Documentation discipline

Documentation should describe the repository as it currently works.

Do not:

- document commands before dependencies and scripts exist;
- retain obsolete setup paths beside the new one;
- repeat large sections across files;
- turn `AGENTS.md` into a complete product manual;
- hide open decisions by writing proposals as settled facts.

Use links between documents and keep the root `AGENTS.md` focused on enforceable behavior.

## 14. Recommended Codex task sequence after this PR

1. Review the interface prototype for workflow gaps.
2. Add targeted UI or component tests for critical interactions.
3. Add workspace/authentication backend only when the interface workflow is accepted.
4. Add Supabase local structure and tenant migrations as a separate backend milestone.
5. Add workspace authorization and RLS integration tests before campaign persistence.

Do not jump to real AI search workflows before the tenant and runtime foundations are testable.

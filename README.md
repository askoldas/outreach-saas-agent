# Outreach SaaS Agent

A horizontal AI-assisted B2B prospecting platform.

The platform helps a business describe what it sells, define a market, discover suitable companies, research and qualify leads, prepare evidence-based outreach, and keep a human in control of approval and sending.

Medical sales is the first validation scenario, not a product limitation. The domain model and implementation must remain suitable for products, services, software, manufacturing, distribution, consulting, and other B2B offers.

## Current status

The repository now contains an interface-first Next.js prototype in the repository root.

The prototype uses typed mock data to demonstrate the intended workflow: offers, campaigns, lead review, evidence, qualification, and outreach draft review. It does not include authentication, a database, Supabase, providers, queues, workers, or email sending.

## Prerequisites

- Node.js 22.18 or newer
- Corepack-enabled pnpm 10.13.1

## Local development

Install dependencies:

```bash
corepack pnpm install
```

Start the development server:

```bash
corepack pnpm dev
```

Run quality checks:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

## Documentation

- [Codex instructions](AGENTS.md)
- [Product definition](docs/PRODUCT.md)
- [Repository structure](docs/REPOSITORY_STRUCTURE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Domain model](docs/DOMAIN_MODEL.md)
- [AI pipeline](docs/AI_PIPELINE.md)
- [Security and compliance](docs/SECURITY_AND_COMPLIANCE.md)
- [Testing strategy](docs/TESTING.md)
- [Delivery roadmap](docs/ROADMAP.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Codex workflow](docs/CODEX_WORKFLOW.md)

## Core principles

1. The product is horizontal; campaigns adapt to the user's offer and target market.
2. AI output must be traceable to evidence whenever it makes a factual claim about a prospect.
3. Research, qualification, drafting, approval, and sending are separate stages.
4. No automatic outreach is sent in the MVP.
5. Long-running research runs outside normal web request lifecycles.
6. Provider-specific integrations stay behind internal interfaces.
7. Multi-tenant data isolation is mandatory from the first database migration.
8. Codex work must be small, testable, and documented.

## Current implementation

The current implementation is a single root Next.js application using:

- App Router;
- TypeScript with strict checking;
- CSS Modules and global design tokens;
- typed centralized mock data;
- no external API calls or secrets.

Future backend, worker, and provider layers should be introduced only when a milestone requires real runtime behavior.

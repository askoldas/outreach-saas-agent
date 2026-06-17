# Repository Structure

## 1. Current goal

Begin as one conventional root Next.js application focused on the product interface.

The current repository is an interface-first prototype. It uses typed mock data to demonstrate the intended workflow without authentication, Supabase, providers, queues, workers, or external API calls.

Separate internal packages, a worker, and provider adapters may be extracted later when real runtime requirements appear. They should not be created merely because future architecture may need them.

## 2. Current top-level structure

```text
outreach-saas-agent/
├─ AGENTS.md
├─ README.md
├─ docs/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ dashboard/
│  │  ├─ offers/
│  │  ├─ campaigns/
│  │  ├─ leads/
│  │  ├─ drafts/
│  │  └─ settings/
│  ├─ components/
│  │  ├─ feedback/
│  │  ├─ layout/
│  │  └─ ui/
│  ├─ data/
│  │  └─ mock/
│  ├─ features/
│  │  ├─ campaigns/
│  │  ├─ drafts/
│  │  ├─ leads/
│  │  ├─ offers/
│  │  └─ shared/
│  ├─ lib/
│  ├─ styles/
│  └─ types/
├─ package.json
├─ pnpm-lock.yaml
├─ next.config.ts
├─ tsconfig.json
├─ eslint.config.mjs
├─ prettier.config.mjs
└─ .env.example
```

Do not add `apps/`, `packages/`, `workers/`, `supabase/`, or `turbo.json` in the current phase.

## 3. Folder responsibilities

### `src/app`

Next.js App Router routes and route-level composition.

Routes should remain server components by default. Use client components only for local interaction such as filters, mock form notices, drawers, and draft editing.

### `src/components`

Reusable interface primitives and application chrome.

- `layout`: persistent shell, sidebar, and top bar.
- `ui`: small primitives such as button, badge, card, page header, and form styling.
- `feedback`: empty states and loading skeletons.

Do not grow this into a broad component library before real reuse exists.

### `src/features`

Feature-oriented UI modules for workflow areas:

- dashboard;
- offers;
- campaigns;
- leads;
- drafts.

Feature folders are the current internal module boundary. When backend behavior arrives, keep feature-specific UI and orchestration close to the route that uses it until extraction provides clear value.

### `src/data/mock`

Centralized typed mock data.

Large mock objects should not be scattered through route components. Mock data must remain horizontal and use fictional companies, domains, contacts, and campaigns.

### `src/types`

Shared TypeScript types for the prototype domain language.

These are not database schemas and do not imply a persistence implementation.

### `src/lib`

Small framework-safe helpers used by the interface, such as status labels and tone mapping.

## 4. Current boundaries

The current prototype must not include:

- authentication;
- Supabase or database code;
- API routes for future functionality;
- AI provider SDKs;
- search or crawler integrations;
- queue or worker infrastructure;
- email sending integrations;
- automatic outreach sending.

The mock interface may show future workflow states, but it must not pretend those states are persisted or executed by a backend.

## 5. Future extraction

Extract separate modules only when the code has real pressure:

- backend persistence and authorization after tenant isolation is implemented;
- provider adapters when real providers are selected;
- a worker when long-running research needs durable execution;
- shared packages if multiple deployable runtimes need the same code.

Until then, feature folders inside the root Next.js application are the preferred structure.

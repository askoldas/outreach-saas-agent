# Public Website Routes

The public-site routing follows `opptium-public-website-strategy.md`. Public, authentication, and authenticated application pages share one Next.js deployment but use separate route groups and layouts.

## Public sitemap

- `/`: public homepage placeholder
- `/product`: product overview
- `/use-cases`: launch use-case overview
- `/features`: feature overview
- `/features/b2b-lead-discovery`
- `/features/lead-research-and-qualification`
- `/features/contact-enrichment`
- `/features/outbound-automation`
- `/pricing`
- `/security`
- `/resources`
- `/about`
- `/contact`
- `/privacy`
- `/terms`

These routes currently provide honest placeholders. They must not claim automated sending, mailboxes, sequences, follow-ups, reply handling, final prices, certifications, or final legal terms until those capabilities and materials are verified. The Resources hub should remain unindexed until substantive content exists.

## Authentication

- `/login`: canonical sign-in URL
- `/signup`: canonical registration URL
- `/logout`: authenticated POST endpoint

Navigation from the public site to `/login` or `/signup` is intercepted into an accessible modal. Direct visits and protected-route redirects render the same content as standalone pages. Authentication errors and `next` destinations remain encoded in the canonical URL.

## Authenticated application

- `/dashboard` (compatibility redirect to `/campaigns`)
- `/company-profile`
- `/campaigns`
- `/campaigns/new`
- `/campaigns/[id]`
- `/campaigns/[id]/strategy`
- `/campaigns/[id]/leads`
- `/campaigns/[id]/outreach`
- `/leads` (redirect to Contacts)
- `/leads/contacts`
- `/leads/companies`
- `/sequences`
- `/usage`
- `/settings`
- `/help`
- `/onboarding/workspace`

The `(app)` layout enforces authentication and supplies the application shell and workspace context. Application pages are `noindex`. Server repositories and database RLS remain the authorization boundary.

The authenticated product opens on Campaigns. Global Leads aggregates persisted companies and contact routes across campaigns; global Sequences aggregates persisted outreach drafts by campaign. Campaign-local navigation presents the workflow as Discover → Contacts → Sequence while retaining established campaign URLs. Sending, scheduling, reply metrics, and named-person records are not shown because those backend models do not yet exist.

## Source structure

```text
src/app/
├── (marketing)/     public pages and marketing layout
├── (auth)/          standalone login, signup, and logout
├── (app)/           authenticated product and application shell
├── @modal/          intercepted login/signup presentation
├── api/             authenticated server endpoints
└── layout.tsx       root HTML, global CSS, and modal slot
```

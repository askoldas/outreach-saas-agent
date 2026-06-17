import type { ActivityItem, Campaign, Lead, Offer, OutreachDraft } from "@/types/domain";

export const offers: Offer[] = [
  {
    id: "precision-parts",
    name: "Precision CNC component production",
    type: "manufacturing",
    summary:
      "Short-run and repeatable CNC machining for equipment builders that need reliable tolerances and documented production handoff.",
    status: "active",
    approvedVersion: "v3 approved",
    lastUpdated: "Today",
    campaignCount: 2,
    problems: [
      "Supplier bottlenecks",
      "Prototype-to-production handoff",
      "Tolerance drift",
    ],
    capabilities: ["CNC milling", "Small-batch production", "Inspection reports"],
    customerValue: ["Shorter supplier qualification", "Clear production documentation"],
    buyerTypes: ["Operations managers", "Procurement teams", "Engineering leads"],
    differentiators: ["Fast fixture changes", "Engineering review before quoting"],
    limitations: ["No commodity fastener sourcing", "Best fit below 5,000 units per run"],
    keywords: ["CNC", "machined components", "precision supplier", "OEM parts"],
    aiProposals: ["Add example tolerance ranges if approved by the team"],
    missingInfo: ["Named certifications", "Typical lead time ranges"],
  },
  {
    id: "finance-automation",
    name: "Invoice operations automation",
    type: "software",
    summary:
      "Workflow software that helps finance teams route invoices, resolve exceptions, and track approval bottlenecks.",
    status: "active",
    approvedVersion: "v2 approved",
    lastUpdated: "Yesterday",
    campaignCount: 1,
    problems: [
      "Manual approval chasing",
      "Late month-end accruals",
      "Duplicate invoice risk",
    ],
    capabilities: ["Approval routing", "Exception queues", "ERP export"],
    customerValue: [
      "Cleaner handoffs",
      "Fewer late approvals",
      "Better status visibility",
    ],
    buyerTypes: ["Finance directors", "AP managers", "Operations leaders"],
    differentiators: ["Implementation plan for lean finance teams"],
    limitations: ["Not a replacement for the ERP general ledger"],
    keywords: ["invoice workflow", "AP automation", "approval routing"],
    aiProposals: ["Clarify supported ERP exports"],
    missingInfo: ["Security review package", "Integration examples"],
  },
  {
    id: "field-maintenance",
    name: "Industrial maintenance service",
    type: "service",
    summary:
      "Preventive maintenance and rapid-response service for production facilities with critical mechanical equipment.",
    status: "draft",
    approvedVersion: "No approved version",
    lastUpdated: "3 days ago",
    campaignCount: 0,
    problems: [
      "Unplanned downtime",
      "Maintenance backlog",
      "Limited in-house specialists",
    ],
    capabilities: [
      "On-site inspection",
      "Maintenance planning",
      "Emergency repair coordination",
    ],
    customerValue: ["Reduced downtime risk", "Clearer maintenance priorities"],
    buyerTypes: ["Plant managers", "Maintenance managers", "Operations directors"],
    differentiators: ["Multi-vendor mechanical experience"],
    limitations: ["No electrical certification claims approved yet"],
    keywords: ["industrial maintenance", "plant service", "mechanical repair"],
    aiProposals: ["Add sector-specific service examples after review"],
    missingInfo: ["Service regions", "Emergency response availability"],
  },
];

export const campaigns: Campaign[] = [
  {
    id: "nordic-oem",
    name: "Nordic equipment builders",
    offerId: "precision-parts",
    objective: "Direct buyers",
    geography: "Sweden and Denmark",
    targetSegments: [
      "Equipment manufacturers",
      "Automation integrators",
      "Industrial OEMs",
    ],
    progress: 68,
    leadCount: 42,
    awaitingReview: 9,
    status: "running",
    lastActivity: "12 min ago",
    language: "English",
    warnings: ["Two directory sources returned stale pages"],
    strategy: {
      terms: [
        "custom machined parts",
        "OEM component supplier",
        "industrial equipment manufacturer",
      ],
      localizedTerms: ["maskinkomponenter", "industrikomponenter", "underleverandor"],
      sources: ["Company websites", "Industry directories", "Association member lists"],
      criteria: [
        "Manufactures complex equipment",
        "Likely recurring component needs",
        "Public contact route",
      ],
      exclusions: ["Retail-only businesses", "Companies below prototype stage"],
      limitations: ["Employee counts may be incomplete for private firms"],
    },
  },
  {
    id: "uk-accounting",
    name: "UK accounting operations teams",
    offerId: "finance-automation",
    objective: "Direct buyers",
    geography: "United Kingdom",
    targetSegments: ["Mid-market accounting firms", "Shared-service finance teams"],
    progress: 44,
    leadCount: 27,
    awaitingReview: 6,
    status: "running",
    lastActivity: "38 min ago",
    language: "English",
    warnings: ["Some contacts are general inboxes only"],
    strategy: {
      terms: [
        "accounts payable workflow",
        "invoice approval bottlenecks",
        "finance operations team",
      ],
      localizedTerms: ["AP automation UK", "invoice approval software"],
      sources: ["Company websites", "Job postings", "Software review directories"],
      criteria: [
        "Finance team visible",
        "Operational complexity",
        "Evidence of approval workflows",
      ],
      exclusions: ["Solo consultancies", "Pure bookkeeping marketplaces"],
      limitations: ["Job postings are treated as signals, not confirmed buying intent"],
    },
  },
  {
    id: "benelux-maintenance",
    name: "Benelux production facilities",
    offerId: "field-maintenance",
    objective: "Service partnerships",
    geography: "Belgium and Netherlands",
    targetSegments: [
      "Food production plants",
      "Packaging facilities",
      "Light manufacturing",
    ],
    progress: 18,
    leadCount: 11,
    awaitingReview: 3,
    status: "planning",
    lastActivity: "2 hours ago",
    language: "English",
    warnings: ["Offer version still needs approval before launch"],
    strategy: {
      terms: [
        "production maintenance partner",
        "mechanical maintenance plant",
        "packaging line service",
      ],
      localizedTerms: ["onderhoud productie", "mechanisch onderhoud"],
      sources: ["Company websites", "Procurement portals", "Industrial directories"],
      criteria: ["Runs production equipment", "Has maintenance-relevant operations"],
      exclusions: ["Facility cleaning providers", "Residential service companies"],
      limitations: ["Service-region fit needs manual confirmation"],
    },
  },
];

export const leads: Lead[] = [
  {
    id: "arclift",
    company: "Arclift Automation",
    website: "https://example.com/arclift",
    country: "Sweden",
    city: "Vasteras",
    campaignId: "nordic-oem",
    companyType: "Industrial OEM",
    industry: "Factory automation",
    estimatedSize: "120-180 employees",
    description:
      "Builds modular handling equipment and robotic cells for regional manufacturers.",
    fitScore: 88,
    confidence: "high",
    contactability: "medium",
    status: "needs_review",
    summary:
      "Strong fit because the company builds custom equipment and describes recurring component sourcing needs, but contact routing is still general.",
    qualification: [
      {
        label: "Industry fit",
        score: 92,
        confidence: "high",
        explanation: "Public pages focus on industrial automation equipment.",
      },
      {
        label: "Need fit",
        score: 86,
        confidence: "medium",
        explanation:
          "Multiple product pages mention custom frames and machined subassemblies.",
      },
      {
        label: "Company fit",
        score: 90,
        confidence: "high",
        explanation:
          "The company appears large enough for recurring supplier qualification.",
      },
      {
        label: "Geography fit",
        score: 95,
        confidence: "high",
        explanation: "Located inside the selected Nordic target geography.",
      },
      {
        label: "Commercial fit",
        score: 82,
        confidence: "medium",
        explanation: "Project-based manufacturing suggests periodic supplier evaluation.",
      },
      {
        label: "Contactability",
        score: 64,
        confidence: "medium",
        explanation:
          "A general procurement inbox is listed, but no named buyer is confirmed.",
      },
      {
        label: "Evidence quality",
        score: 84,
        confidence: "high",
        explanation: "Claims are backed by company pages retrieved this week.",
      },
      {
        label: "Exclusion risk",
        score: 12,
        confidence: "medium",
        explanation: "No hard exclusion was found.",
      },
    ],
    evidence: [
      {
        id: "ev-arclift-1",
        kind: "fact",
        text: "The company describes robotic handling cells and custom automation equipment.",
        sourceType: "Company website",
        sourceLabel: "Capabilities page",
        sourceUrl: "https://example.com/arclift/capabilities",
        retrievedAt: "2026-06-18",
        confidence: "high",
      },
      {
        id: "ev-arclift-2",
        kind: "fact",
        text: "A procurement contact inbox is listed on the contact page.",
        sourceType: "Company website",
        sourceLabel: "Contact page",
        sourceUrl: "https://example.com/arclift/contact",
        retrievedAt: "2026-06-18",
        confidence: "medium",
      },
      {
        id: "ev-arclift-3",
        kind: "inference",
        text: "Custom equipment production may create a need for repeatable machined components.",
        sourceType: "AI inference",
        sourceLabel: "Derived from capability evidence",
        sourceUrl: "https://example.com/arclift/capabilities",
        retrievedAt: "2026-06-18",
        confidence: "medium",
      },
    ],
    contacts: [
      {
        type: "Department email",
        value: "procurement@example.com",
        suggestedRole: "Procurement or operations",
        verification: "source_confirmed",
        source: "Company contact page",
      },
      {
        type: "Contact form",
        value: "Website form",
        suggestedRole: "Supplier introduction",
        verification: "unverified",
        source: "Company contact page",
      },
    ],
  },
  {
    id: "ledgerfield",
    company: "Ledgerfield Advisory",
    website: "https://example.com/ledgerfield",
    country: "United Kingdom",
    city: "Manchester",
    campaignId: "uk-accounting",
    companyType: "Professional services",
    industry: "Accounting and advisory",
    estimatedSize: "80-120 employees",
    description:
      "Regional accounting and advisory firm with dedicated outsourced finance operations.",
    fitScore: 81,
    confidence: "medium",
    contactability: "high",
    status: "draft_ready",
    summary:
      "Good fit for finance workflow automation because the firm publicly describes outsourced finance operations and has a visible operations contact route.",
    qualification: [
      {
        label: "Industry fit",
        score: 86,
        confidence: "high",
        explanation: "Services align with finance operations and advisory work.",
      },
      {
        label: "Need fit",
        score: 78,
        confidence: "medium",
        explanation:
          "Workflow complexity is inferred from outsourced finance service pages.",
      },
      {
        label: "Company fit",
        score: 80,
        confidence: "medium",
        explanation: "Size estimate suggests enough volume for process tooling.",
      },
      {
        label: "Geography fit",
        score: 94,
        confidence: "high",
        explanation: "UK-based company in the selected market.",
      },
      {
        label: "Commercial fit",
        score: 76,
        confidence: "medium",
        explanation: "Operational service delivery may benefit from approval visibility.",
      },
      {
        label: "Contactability",
        score: 88,
        confidence: "high",
        explanation: "A department route and contact form are visible.",
      },
      {
        label: "Evidence quality",
        score: 74,
        confidence: "medium",
        explanation: "Evidence is current but some operational detail is inferred.",
      },
      {
        label: "Exclusion risk",
        score: 18,
        confidence: "medium",
        explanation: "No solo consultancy or marketplace-only signal found.",
      },
    ],
    evidence: [
      {
        id: "ev-ledgerfield-1",
        kind: "fact",
        text: "The services page lists outsourced finance operations and reporting support.",
        sourceType: "Company website",
        sourceLabel: "Services page",
        sourceUrl: "https://example.com/ledgerfield/services",
        retrievedAt: "2026-06-18",
        confidence: "high",
      },
      {
        id: "ev-ledgerfield-2",
        kind: "unknown",
        text: "The site does not state which accounting or ERP systems are used.",
        sourceType: "Company website",
        sourceLabel: "Technology details absent",
        sourceUrl: "https://example.com/ledgerfield/services",
        retrievedAt: "2026-06-18",
        confidence: "high",
      },
    ],
    contacts: [
      {
        type: "General email",
        value: "hello@example.com",
        suggestedRole: "Finance operations lead",
        verification: "source_confirmed",
        source: "Contact page",
      },
    ],
  },
  {
    id: "packnorth",
    company: "Packnorth Foods",
    website: "https://example.com/packnorth",
    country: "Netherlands",
    city: "Eindhoven",
    campaignId: "benelux-maintenance",
    companyType: "Manufacturer",
    industry: "Food packaging",
    estimatedSize: "220-300 employees",
    description:
      "Produces packaged food products with multiple automated packaging lines.",
    fitScore: 73,
    confidence: "medium",
    contactability: "low",
    status: "researching",
    summary:
      "Potential service fit, but the offer still needs approval and maintenance contact evidence is incomplete.",
    qualification: [
      {
        label: "Industry fit",
        score: 82,
        confidence: "medium",
        explanation: "Production operations match the intended maintenance segment.",
      },
      {
        label: "Need fit",
        score: 70,
        confidence: "low",
        explanation: "Maintenance needs are plausible but not directly stated.",
      },
      {
        label: "Company fit",
        score: 76,
        confidence: "medium",
        explanation: "Company size and facility type suggest relevant operations.",
      },
      {
        label: "Geography fit",
        score: 88,
        confidence: "high",
        explanation: "Located in the target geography.",
      },
      {
        label: "Commercial fit",
        score: 66,
        confidence: "low",
        explanation: "No public procurement or supplier process found yet.",
      },
      {
        label: "Contactability",
        score: 42,
        confidence: "low",
        explanation: "Only a general contact form has been found.",
      },
      {
        label: "Evidence quality",
        score: 62,
        confidence: "medium",
        explanation: "Evidence is company-level but not maintenance-specific.",
      },
      {
        label: "Exclusion risk",
        score: 24,
        confidence: "medium",
        explanation: "No clear exclusion found.",
      },
    ],
    evidence: [
      {
        id: "ev-packnorth-1",
        kind: "fact",
        text: "The company describes automated packaging operations.",
        sourceType: "Company website",
        sourceLabel: "Operations page",
        sourceUrl: "https://example.com/packnorth/operations",
        retrievedAt: "2026-06-18",
        confidence: "medium",
      },
      {
        id: "ev-packnorth-2",
        kind: "unknown",
        text: "No public maintenance department contact has been found.",
        sourceType: "Research result",
        sourceLabel: "Contact search",
        sourceUrl: "https://example.com/packnorth/contact",
        retrievedAt: "2026-06-18",
        confidence: "medium",
      },
    ],
    contacts: [
      {
        type: "Contact form",
        value: "Website form",
        suggestedRole: "Operations or maintenance",
        verification: "unknown",
        source: "Contact page",
      },
    ],
  },
];

export const drafts: OutreachDraft[] = [
  {
    id: "draft-ledgerfield-primary",
    leadId: "ledgerfield",
    campaignId: "uk-accounting",
    recipientRoute: "hello@example.com",
    subject: "Improving invoice approval visibility for finance operations",
    body: "Hello,\n\nI noticed Ledgerfield describes outsourced finance operations and reporting support. Northstar Components is testing a lightweight invoice workflow tool for teams that need clearer approval routing and exception queues without replacing their ERP.\n\nWould it be useful to compare notes on where invoice approvals tend to slow down for your team?\n\nBest,\nAlex",
    variant: "primary",
    language: "English",
    status: "needs_review",
    lastEdited: "26 min ago",
    sellerClaims: ["Approval routing", "Exception queues", "ERP export"],
    evidenceUsed: ["ev-ledgerfield-1"],
    warnings: ["ERP system is unknown; do not mention a specific integration."],
  },
  {
    id: "draft-arclift-short",
    leadId: "arclift",
    campaignId: "nordic-oem",
    recipientRoute: "procurement@example.com",
    subject: "CNC component supplier for automation equipment",
    body: "Hello,\n\nYour site describes custom automation equipment and robotic handling cells. We support equipment builders with short-run CNC components and inspection documentation.\n\nWould a supplier introduction be relevant for your procurement team?\n\nBest,\nAlex",
    variant: "short",
    language: "English",
    status: "edited",
    lastEdited: "1 hour ago",
    sellerClaims: ["CNC milling", "Small-batch production", "Inspection reports"],
    evidenceUsed: ["ev-arclift-1", "ev-arclift-2"],
    warnings: ["Use procurement route; no named buyer is confirmed."],
  },
];

export const activity: ActivityItem[] = [
  {
    id: "act-1",
    time: "12 min ago",
    label: "Lead evidence updated",
    description: "Arclift Automation gained a procurement source claim.",
  },
  {
    id: "act-2",
    time: "26 min ago",
    label: "Draft generated",
    description: "Ledgerfield Advisory primary outreach draft is awaiting review.",
  },
  {
    id: "act-3",
    time: "38 min ago",
    label: "Campaign progressed",
    description: "UK accounting operations teams reached 44% of planned review volume.",
  },
  {
    id: "act-4",
    time: "2 hours ago",
    label: "Strategy warning",
    description: "Benelux production facilities requires offer approval before launch.",
  },
];

export function getOffer(id: string) {
  return offers.find((offer) => offer.id === id);
}

export function getCampaign(id: string) {
  return campaigns.find((campaign) => campaign.id === id);
}

export function getLead(id: string) {
  return leads.find((lead) => lead.id === id);
}

export function getDraft(id: string) {
  return drafts.find((draft) => draft.id === id);
}

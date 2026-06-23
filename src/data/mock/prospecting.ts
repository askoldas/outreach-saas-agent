import type { ActivityItem, Campaign, Lead, Offer, OutreachDraft } from "@/types/domain";

export const offers: Offer[] = [
  {
    id: "pharmacy-medical-supply-distribution",
    name: "Pharmacy and medical supply distribution",
    type: "distribution",
    summary:
      "B2B distribution of pharmacy, parapharmacy, healthcare and medical supply products for pharmacies, parapharmacies, online pharmacies, pharmacy chains, wholesalers and medical supply companies.",
    status: "active",
    approvedVersion: "v1 approved",
    lastUpdated: "Today",
    campaignCount: 1,
    problems: [
      "Difficulty finding reliable suppliers",
      "Limited product availability",
      "Slow sourcing",
      "Fragmented purchasing",
      "Need for additional pharmacy and healthcare product categories",
      "Lack of flexible B2B supply partners",
    ],
    capabilities: [
      "B2B product sourcing",
      "Pharmacy and parapharmacy supply",
      "Healthcare product distribution",
      "Medical supply assortment support",
      "Wholesale cooperation",
      "Product availability support",
      "Distribution partnerships in Italy",
    ],
    customerValue: [
      "Access to additional products and supply channels",
      "Reduced sourcing friction",
      "Expanded product range",
      "Reliable B2B partner for ongoing purchasing",
      "Potential distribution cooperation",
    ],
    buyerTypes: [
      "Independent pharmacies",
      "Pharmacy chains",
      "Parapharmacies",
      "Online pharmacies",
      "Pharmaceutical wholesalers",
      "Healthcare product distributors",
      "Medical supply distributors",
      "Pharmacy cooperatives",
      "Health retail groups",
    ],
    differentiators: [
      "International B2B supply focus",
      "Flexible cooperation model",
      "Relevant across pharmacy and healthcare retail",
      "Potential assortment expansion",
      "Can support direct buyers and distribution partners",
    ],
    limitations: [
      "Exact product categories must be confirmed before outreach",
      "Certifications and registration requirements must be checked",
      "Shipping conditions and minimum order quantities must be confirmed",
      "Not intended for hospitals without procurement or distribution relevance",
      "Not intended for individual doctors or consumer-only health portals",
      "Not intended for companies outside Italy",
    ],
    keywords: [
      "pharmacy supplies",
      "pharmaceutical distribution",
      "pharmacy wholesaler",
      "healthcare products",
      "medical supplies",
      "parapharmacy",
      "online pharmacy",
      "pharmacy chain",
      "pharmacy cooperative",
      "Italy pharmacy distributor",
      "farmacia",
      "parafarmacia",
      "grossista farmaceutico",
      "distributore farmaceutico",
      "prodotti sanitari",
      "dispositivi medici",
      "forniture farmacia",
    ],
    aiProposals: [
      "Confirm exact product categories, certifications, logistics conditions and regulatory requirements before outreach.",
    ],
    missingInfo: [
      "Exact product catalogue",
      "Certifications and registrations",
      "Shipping regions and delivery terms",
      "Minimum order quantities",
      "Preferred buyer or partner type",
    ],
  },
];

export const campaigns: Campaign[] = [
  {
    id: "italy-pharmacy-and-healthcare-distribution-leads",
    name: "Italy pharmacy and healthcare distribution leads",
    offerId: "pharmacy-medical-supply-distribution",
    objective: "Direct buyers",
    geography: "Italy",
    industryTerms: [
      "Pharmacies",
      "Parapharmacies",
      "Online pharmacies",
      "Pharmacy chains",
      "Pharmaceutical wholesalers",
      "Healthcare product distributors",
      "Medical supply distributors",
      "Medical device distributors",
      "Parapharmaceutical products",
      "Health and wellness retail",
    ],
    targetSegments: [
      "Independent pharmacies",
      "Pharmacy chains",
      "Parapharmacies",
      "Online pharmacies",
      "Pharmaceutical wholesalers",
      "Healthcare product distributors",
      "Medical supply distributors",
      "Medical device distributors",
      "Pharmacy cooperatives",
      "Health retail groups",
    ],
    progress: 0,
    desiredLeadCount: 25,
    leadCount: 0,
    awaitingReview: 0,
    status: "planning",
    lastActivity: "Ready to launch",
    language: "Italian",
    latestDiscoveryReport: null,
    warnings: [],
    strategy: {
      terms: [
        "pharmacy supplies",
        "pharmaceutical distribution",
        "pharmacy wholesaler",
        "healthcare products",
        "medical supplies",
        "parapharmacy",
        "online pharmacy",
        "pharmacy chain",
        "pharmacy cooperative",
        "pharmacy group",
        "healthcare product distributor",
        "medical supply distributor",
        "medical device distributor",
        "parapharmaceutical products",
        "health and wellness retail",
      ],
      localizedTerms: [
        "farmacia",
        "farmacie",
        "parafarmacia",
        "parafarmacie",
        "farmacia online",
        "farmacie online",
        "catena di farmacie",
        "gruppo farmacie",
        "cooperativa farmaceutica",
        "grossista farmaceutico",
        "distributore farmaceutico",
        "distributore prodotti sanitari",
        "dispositivi medici",
        "forniture farmacia",
        "prodotti parafarmaceutici",
        "ingrosso prodotti farmaceutici",
        "fornitori farmacie",
      ],
      sources: [
        "Company websites",
        "Contact pages",
        "Online pharmacy websites",
        "Pharmacy chain websites",
        "Parapharmacy websites",
        "Pharmaceutical wholesaler websites",
        "Medical supply distributor websites",
        "Healthcare product distributor websites",
        "Pharmacy cooperative websites",
        "Relevant Italian industry directories",
      ],
      criteria: [
        "Company operates in Italy",
        "Company sells or buys pharmacy, parapharmacy, healthcare or medical supply products",
        "Company has a public website or contact route",
        "Company appears commercially active",
        "Company fits B2B purchasing or distribution cooperation",
      ],
      exclusions: [
        "News articles",
        "Blogs",
        "Job posts",
        "Government-only pages",
        "Individual doctors",
        "Hospitals without procurement or distribution relevance",
        "Consumer-only health portals",
        "Companies outside Italy",
        "Duplicate company domains",
        "Retail pages without company contact details",
      ],
      limitations: [
        "Search results must be reviewed before outreach",
        "Tavily snippets should not be treated as final evidence",
        "AI qualification failure must not prevent discovered leads from being saved",
        "Product-category and regulatory fit must be confirmed manually before outreach",
      ],
    },
  },
];

export const leads: Lead[] = [];

export const drafts: OutreachDraft[] = [];

export const activity: ActivityItem[] = [
  {
    id: "act-pharma-campaign-ready",
    time: "Today",
    label: "Sample campaign prepared",
    description:
      "Italy pharmacy and healthcare distribution leads is ready for discovery.",
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

export type OfferType =
  | "product"
  | "service"
  | "software"
  | "distribution"
  | "manufacturing"
  | "partnership";

export type OfferStatus = "draft" | "active" | "archived";
export type CampaignStatus = "planning" | "running" | "paused" | "completed";
export type LeadStatus =
  | "needs_review"
  | "approved"
  | "rejected"
  | "draft_ready"
  | "researching"
  | "archived";
export type Confidence = "high" | "medium" | "low";
export type EvidenceKind = "fact" | "inference" | "unknown" | "conflict";
export type DraftStatus = "needs_review" | "approved" | "edited" | "rejected";
export type LeadQualificationStatus =
  | "pending"
  | "qualified"
  | "failed"
  | "needs_manual_review"
  | "non_ai_manual_review";

export type DiscoveryReportResult = {
  query: string;
  title: string;
  url: string;
};

export type DiscoveryReportRejectedResult = DiscoveryReportResult & {
  reason: string;
};

export type DiscoveryReportAiFailure = {
  error: string;
  leadId: string;
};

export type ContactDiscoveryAttempt = {
  error: string;
  status: "failed" | "fetched" | "skipped";
  url: string;
};

export type ContactDiscoveryReport = {
  attempts: ContactDiscoveryAttempt[];
  leadId: string;
  routesFound: number;
};

export type DiscoveryReport = {
  aiQualificationFailures: DiscoveryReportAiFailure[];
  aiQualificationSuccesses: string[];
  contactDiscovery: ContactDiscoveryReport[];
  contactRoutesFound: number;
  duplicateResults: DiscoveryReportRejectedResult[];
  finalReviewableLeads: string[];
  generatedAt: string;
  leadsSavedBeforeAiQualification: string[];
  queriesExecuted: string[];
  rawTavilyResults: DiscoveryReportResult[];
  rejectedResults: DiscoveryReportRejectedResult[];
};

export type Offer = {
  id: string;
  name: string;
  type: OfferType;
  summary: string;
  status: OfferStatus;
  approvedVersion: string;
  lastUpdated: string;
  campaignCount: number;
  problems: string[];
  capabilities: string[];
  customerValue: string[];
  buyerTypes: string[];
  differentiators: string[];
  limitations: string[];
  keywords: string[];
  aiProposals: string[];
  missingInfo: string[];
};

export type Campaign = {
  id: string;
  name: string;
  offerId: string;
  objective: string;
  geography: string;
  industryTerms: string[];
  targetSegments: string[];
  progress: number;
  leadCount: number;
  desiredLeadCount: number;
  awaitingReview: number;
  status: CampaignStatus;
  lastActivity: string;
  language: string;
  warnings: string[];
  latestDiscoveryReport: DiscoveryReport | null;
  strategy: {
    terms: string[];
    localizedTerms: string[];
    sources: string[];
    criteria: string[];
    exclusions: string[];
    limitations: string[];
  };
};

export type QualificationDimension = {
  label: string;
  score: number;
  confidence: Confidence;
  explanation: string;
};

export type EvidenceClaim = {
  id: string;
  kind: EvidenceKind;
  text: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string;
  retrievedAt: string;
  confidence: Confidence;
};

export type ContactRoute = {
  type: string;
  value: string;
  suggestedRole: string;
  verification: "source_confirmed" | "unverified" | "unknown";
  source: string;
};

export type Lead = {
  id: string;
  company: string;
  website: string;
  country: string;
  city: string;
  campaignId: string;
  companyType: string;
  industry: string;
  estimatedSize: string;
  description: string;
  fitScore: number;
  confidence: Confidence;
  contactability: Confidence;
  qualificationError: string;
  qualificationStatus: LeadQualificationStatus;
  status: LeadStatus;
  summary: string;
  qualification: QualificationDimension[];
  evidence: EvidenceClaim[];
  contacts: ContactRoute[];
};

export type OutreachDraft = {
  id: string;
  leadId: string;
  campaignId: string;
  recipientRoute: string;
  subject: string;
  body: string;
  variant: "primary" | "short" | "follow_up";
  language: string;
  status: DraftStatus;
  lastEdited: string;
  sellerClaims: string[];
  evidenceUsed: string[];
  warnings: string[];
};

export type ActivityItem = {
  id: string;
  time: string;
  label: string;
  description: string;
};

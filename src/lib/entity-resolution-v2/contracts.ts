export type ExternalOrganizationType =
  | "company_group"
  | "operating_company"
  | "legal_entity"
  | "business_unit"
  | "brand"
  | "branch"
  | "storefront"
  | "franchisee"
  | "franchisor"
  | "association"
  | "public_institution"
  | "nonprofit"
  | "marketplace"
  | "marketplace_seller"
  | "sole_trader"
  | "unknown";

export type OrganizationRelationshipType =
  | "owns"
  | "owned_by"
  | "controls"
  | "controlled_by"
  | "subsidiary_of"
  | "parent_of"
  | "operates"
  | "operated_by"
  | "brand_of"
  | "owns_brand"
  | "branch_of"
  | "has_branch"
  | "storefront_of"
  | "has_storefront"
  | "franchisee_of"
  | "franchisor_of"
  | "business_unit_of"
  | "has_business_unit"
  | "distributor_for"
  | "distributed_by"
  | "procures_for"
  | "procurement_managed_by"
  | "shares_procurement_with"
  | "formerly_known_as"
  | "successor_of"
  | "predecessor_of"
  | "related_company"
  | "possible_relation";

export type ProcurementAutonomy =
  | "local"
  | "regional"
  | "centralized"
  | "shared"
  | "independent"
  | "unknown";

export type IdentitySignalCategory =
  | "legal_identifier"
  | "domain"
  | "name"
  | "address"
  | "phone"
  | "location"
  | "redirect"
  | "provider_mapping"
  | "entity_type"
  | "contradiction";

export type IdentitySignalAssessment = {
  key: string;
  category: IdentitySignalCategory;
  state: "match" | "partial_match" | "conflict" | "unknown";
  weight: number;
  confidence: number;
  evidenceIds: string[];
  explanation: string;
};

export type OrganizationIdentity = {
  organizationId: string;
  normalizedName: string;
  primaryCountry?: string;
  domains: string[];
  canonicalUrls: string[];
  legalIdentifiers: Array<{
    type: string;
    jurisdiction: string;
    value: string;
    verified: boolean;
  }>;
  organizationType: ExternalOrganizationType;
};

export type ResolutionCandidate = {
  normalizedCandidateId: string;
  name: string;
  normalizedName?: string;
  country?: string;
  domain?: string;
  canonicalUrl?: string;
  legalIdentifiers?: Array<{
    type: string;
    jurisdiction: string;
    value: string;
    verified: boolean;
  }>;
  organizationType: ExternalOrganizationType;
  sharedDirectoryDomain?: boolean;
};

export type EntityMatchAssessment = {
  normalizedCandidateId: string;
  existingOrganizationId: string;
  signals: IdentitySignalAssessment[];
  aggregateConfidence: number;
  contradictionSeverity: "none" | "low" | "medium" | "high";
  recommendation:
    | "auto_link"
    | "link_as_related_entity"
    | "create_new"
    | "needs_review"
    | "reject_match";
  reasoningSummary: string;
  rulesVersion: string;
};

export type ResolutionOutcome =
  | { action: "link_existing"; assessment: EntityMatchAssessment }
  | { action: "needs_review"; assessments: EntityMatchAssessment[] }
  | { action: "create_new"; assessments: EntityMatchAssessment[] };

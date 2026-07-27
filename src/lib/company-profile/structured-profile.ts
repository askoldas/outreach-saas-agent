export const businessModelTypes = [
  "saas_software",
  "professional_service",
  "agency_consultancy",
  "manufacturer",
  "contract_manufacturer",
  "distributor_wholesaler",
  "partnership_licensing",
  "marketplace",
  "other",
] as const;

export type BusinessModelType = (typeof businessModelTypes)[number];
export type ProfileConfidence = "high" | "medium" | "low";
export type FactOrigin = "explicit" | "inferred" | "user_provided";
export type AudienceBusinessModel = "b2b" | "b2c" | "b2g" | "mixed" | "unclear";
export type CustomerGroupKind =
  | "consumer"
  | "business"
  | "public_institution"
  | "partner"
  | "distributor"
  | "reseller"
  | "supplier"
  | "contractor"
  | "other";

export type CurrentCustomerGroup = {
  id: string;
  name: string;
  kind: CustomerGroupKind;
  evidence: string[];
  confidence: ProfileConfidence;
};

export type PotentialB2BApplication = {
  id: string;
  name: string;
  description: string;
  supportedByCapabilityIds: string[];
  confidence: ProfileConfidence;
  requiresConfirmation: boolean;
};

export type ClarificationImpact =
  | "offering_definition"
  | "business_model"
  | "target_segment"
  | "delivery_constraint"
  | "discovery_feasibility";

export type ClarificationQuestion = {
  id: string;
  question: string;
  reason: string;
  impact: ClarificationImpact;
  answerType: "single_select" | "multi_select" | "short_text" | "boolean";
  options?: Array<{ id: string; label: string; description?: string }>;
  required: boolean;
  skippable: boolean;
  priority: number;
};

export type CompanyProfileBusinessContext = {
  businessModel: AudienceBusinessModel;
  currentCustomerGroups: CurrentCustomerGroup[];
  potentialB2BApplications: PotentialB2BApplication[];
  unresolvedQuestions: ClarificationQuestion[];
};

export type SourceReference = {
  url?: string;
  pageTitle?: string;
  extractedText?: string;
  extractedAt: string;
  confidence: ProfileConfidence;
  origin: FactOrigin;
};

export type ExtractedProfileFact = {
  id: string;
  key: string;
  value: string;
  offeringName?: string;
  source: SourceReference;
};

export type BuyerPersona = {
  titleGroup: string;
  exampleTitles: string[];
  roleInDecision?: "decision_maker" | "influencer" | "user" | "gatekeeper";
  reasonToContact?: string;
};

export type Capability = {
  id: string;
  name: string;
  description?: string;
  relatedOfferingIds: string[];
  evidence?: string[];
  confidence?: ProfileConfidence;
  status?: "confirmed" | "inferred" | "rejected";
};

export type CommercialItemClassification =
  | "offering"
  | "product_category"
  | "capability"
  | "supporting_service"
  | "business_model"
  | "relationship_model"
  | "feature"
  | "irrelevant";

export type CommercialItem = {
  id: string;
  name: string;
  classification: CommercialItemClassification;
  description?: string;
  relatedOfferingIds: string[];
  sourceReferences: SourceReference[];
};

export type Differentiator = {
  id: string;
  title: string;
  scope: "company" | "offering";
  relatedOfferingIds: string[];
  sourceReferences: SourceReference[];
};

export type CustomerLandscape = {
  customerTypes: string[];
  buyerIndustries: string[];
  customerNeeds: string[];
  relationshipTypes: string[];
  existingMarkets: string[];
  potentialMarkets: string[];
};

export type ProofPoint = {
  id: string;
  type:
    | "company_metric"
    | "certification"
    | "facility"
    | "case_study"
    | "customer_reference"
    | "testimonial"
    | "quantified_result"
    | "investment"
    | "strategic_investment"
    | "operational_evidence";
  title: string;
  value?: string;
  description?: string;
  relatedOfferingIds: string[];
  approvedForOutreach: boolean;
  sourceReferences: SourceReference[];
};

export type Offering = {
  id: string;
  name: string;
  offeringType: string;
  businessModel: BusinessModelType;
  shortDescription: string;
  detailedDescription?: string;
  valueProposition?: string;
  customerProblems: string[];
  expectedOutcomes: string[];
  useCases: string[];
  targetCustomerTypes: string[];
  targetIndustries: string[];
  targetCompanySizes: string[];
  buyerPersonas: BuyerPersona[];
  currentMarkets: string[];
  prospectingMarkets: string[];
  pricingModel?: string;
  typicalDealSize?: string;
  typicalSalesCycle?: string;
  qualificationRequirements: string[];
  disqualifyingConditions: string[];
  commercialConstraints: string[];
  supportingCapabilityIds: string[];
  productCategories?: string[];
  supportingProofIds: string[];
  adaptiveFields: Record<string, string | string[]>;
  priority: "primary" | "secondary" | "inactive";
  status: "detected" | "confirmed" | "excluded";
  sourceReferences: SourceReference[];
};

export type CustomerReference = {
  id: string;
  companyName: string;
  industry?: string;
  relationshipType?: string;
  relatedOfferingId?: string;
  isPublic: boolean;
  approvedForOutreach: boolean;
  sourceReferences: SourceReference[];
};

export type CommunicationRules = {
  approvedClaims: string[];
  prohibitedClaims: string[];
  tone?: string;
};

export type ReviewQuestion = {
  stage?: "profile_optional" | "profile_blocking" | "campaign" | "offering_defaults";
  id: string;
  category:
    | "offering"
    | "customer"
    | "market"
    | "buyer_persona"
    | "qualification"
    | "constraint"
    | "claim"
    | "conflict";
  title: string;
  description?: string;
  fieldPath?: string;
  relatedOfferingId?: string;
  inputType:
    | "single_select"
    | "multi_select"
    | "text"
    | "number"
    | "confirm"
    | "resolve_conflict";
  options?: Array<{ id: string; label: string; description?: string }>;
  required: boolean;
  priority?: "blocking" | "important" | "optional";
  status: "unanswered" | "answered" | "skipped" | "dismissed";
  answer?: string | string[];
};

export type ProfileReadiness = {
  companyUnderstanding: number;
  commercialStructure: number;
  offeringDefinition: number;
  sourceReliability: number;
  messagingSafety: number;
  overall: number;
};

export type StructuredCompanyProfile = {
  schemaVersion: 2;
  name: string;
  legalName?: string;
  websiteUrl: string;
  logoUrl?: string;
  shortOverview: string;
  extendedOverview?: string;
  sellerIndustries: string[];
  businessModels: BusinessModelType[];
  headquarters?: string;
  operatingMarkets: string[];
  exportMarkets?: string[];
  prospectingMarkets: string[];
  excludedMarkets: string[];
  companySize?: string;
  companyStage?: string;
  foundedYear?: number;
  legalStructure?: string;
  supportedLanguages: string[];
  outreachLanguages: string[];
  capabilities: Capability[];
  commercialItems?: CommercialItem[];
  customerLandscape?: CustomerLandscape;
  businessContext?: CompanyProfileBusinessContext;
  differentiators?: Differentiator[];
  companyProof: ProofPoint[];
  existingCustomers: CustomerReference[];
  communicationRules: CommunicationRules;
  strategicDirection: string[];
  verifiedClaims?: string[];
  commercialConstraints?: string[];
  regulatoryLimitations?: string[];
  unverifiedInformation?: string[];
  offerings: Offering[];
  status: "draft" | "needs_input" | "ready" | "published";
  readiness: ProfileReadiness;
  research: { pagesAnalyzed: number; factsExtracted: number; sources: SourceReference[] };
};

export function createEmptyStructuredProfile(input: {
  name: string;
  websiteUrl: string;
  language?: string;
}): StructuredCompanyProfile {
  const profile: StructuredCompanyProfile = {
    schemaVersion: 2,
    name: input.name,
    websiteUrl: input.websiteUrl,
    shortOverview: "",
    sellerIndustries: [],
    businessModels: [],
    operatingMarkets: [],
    exportMarkets: [],
    prospectingMarkets: [],
    excludedMarkets: [],
    supportedLanguages: input.language ? [input.language] : [],
    outreachLanguages: input.language ? [input.language] : [],
    capabilities: [],
    commercialItems: [],
    customerLandscape: {
      customerTypes: [],
      buyerIndustries: [],
      customerNeeds: [],
      relationshipTypes: [],
      existingMarkets: [],
      potentialMarkets: [],
    },
    businessContext: {
      businessModel: "unclear",
      currentCustomerGroups: [],
      potentialB2BApplications: [],
      unresolvedQuestions: [],
    },
    differentiators: [],
    companyProof: [],
    existingCustomers: [],
    communicationRules: { approvedClaims: [], prohibitedClaims: [] },
    strategicDirection: [],
    verifiedClaims: [],
    commercialConstraints: [],
    regulatoryLimitations: [],
    unverifiedInformation: [],
    offerings: [],
    status: "draft",
    readiness: {
      companyUnderstanding: 0,
      commercialStructure: 0,
      offeringDefinition: 0,
      sourceReliability: 0,
      messagingSafety: 0,
      overall: 0,
    },
    research: { pagesAnalyzed: 0, factsExtracted: 0, sources: [] },
  };
  return { ...profile, readiness: calculateReadiness(profile) };
}

export function parseStructuredCompanyProfile(value: unknown): StructuredCompanyProfile {
  if (!isRecord(value)) throw new Error("Structured Company Profile must be an object.");
  const offerings = array(value.offerings, "offerings").map(parseOffering);
  uniqueIds(offerings, "offering");
  const capabilities = array(value.capabilities, "capabilities").map(parseCapability);
  uniqueIds(capabilities, "capability");
  const proof = deduplicateByTitle(
    array(value.companyProof, "companyProof").map(parseProof),
  );
  uniqueIds(proof, "proof point");
  const offeringIds = new Set(offerings.map((item) => item.id));
  const capabilityIds = new Set(capabilities.map((item) => item.id));
  const proofIds = new Set(proof.map((item) => item.id));
  for (const offering of offerings) {
    invalidRelations(offering.supportingCapabilityIds, capabilityIds, "capability");
    invalidRelations(offering.supportingProofIds, proofIds, "proof point");
  }
  for (const item of [...capabilities, ...proof])
    invalidRelations(item.relatedOfferingIds, offeringIds, "offering");

  const websiteUrl = url(value.websiteUrl, "websiteUrl");
  const businessModels = stringArray(value.businessModels, "businessModels").map(
    (model) => {
      if (!businessModelTypes.includes(model as BusinessModelType))
        throw new Error(`Unsupported business model: ${model}.`);
      return model as BusinessModelType;
    },
  );
  const profile: StructuredCompanyProfile = {
    schemaVersion: 2,
    name: requiredString(value.name, "name"),
    websiteUrl,
    shortOverview: requiredString(value.shortOverview, "shortOverview", true),
    sellerIndustries: stringArray(value.sellerIndustries, "sellerIndustries"),
    businessModels,
    operatingMarkets: stringArray(value.operatingMarkets ?? [], "operatingMarkets"),
    exportMarkets: stringArray(value.exportMarkets ?? [], "exportMarkets"),
    prospectingMarkets: stringArray(value.prospectingMarkets, "prospectingMarkets"),
    excludedMarkets: stringArray(value.excludedMarkets, "excludedMarkets"),
    supportedLanguages: stringArray(value.supportedLanguages, "supportedLanguages"),
    outreachLanguages: stringArray(value.outreachLanguages, "outreachLanguages"),
    capabilities,
    commercialItems: array(value.commercialItems ?? [], "commercialItems").map(
      parseCommercialItem,
    ),
    customerLandscape: parseCustomerLandscape(value.customerLandscape),
    businessContext: parseBusinessContext(value.businessContext, capabilityIds),
    differentiators: deduplicateByTitle(
      array(value.differentiators ?? [], "differentiators").map(parseDifferentiator),
    ),
    companyProof: proof,
    existingCustomers: array(value.existingCustomers, "existingCustomers").map(
      parseCustomer,
    ),
    communicationRules: parseCommunicationRules(value.communicationRules),
    strategicDirection: stringArray(value.strategicDirection, "strategicDirection"),
    verifiedClaims: stringArray(value.verifiedClaims ?? [], "verifiedClaims"),
    commercialConstraints: stringArray(
      value.commercialConstraints ?? [],
      "commercialConstraints",
    ),
    regulatoryLimitations: stringArray(
      value.regulatoryLimitations ?? [],
      "regulatoryLimitations",
    ),
    unverifiedInformation: stringArray(
      value.unverifiedInformation ?? [],
      "unverifiedInformation",
    ),
    offerings,
    status: status(value.status),
    readiness: parseReadiness(value.readiness),
    research: parseResearch(value.research),
  };
  optionalStringFields(profile, value, [
    "legalName",
    "logoUrl",
    "extendedOverview",
    "headquarters",
    "companySize",
    "companyStage",
    "legalStructure",
  ]);
  if (value.foundedYear !== undefined) {
    if (!Number.isInteger(value.foundedYear) || Number(value.foundedYear) < 1000)
      throw new Error("Invalid foundedYear.");
    profile.foundedYear = Number(value.foundedYear);
  }
  return profile;
}

export function calculateReadiness(
  profile: Pick<
    StructuredCompanyProfile,
    | "name"
    | "websiteUrl"
    | "shortOverview"
    | "offerings"
    | "companyProof"
    | "research"
    | "commercialConstraints"
    | "regulatoryLimitations"
  >,
): ProfileReadiness {
  const active = profile.offerings.filter(
    (item) => item.status !== "excluded" && item.priority !== "inactive",
  );
  const scores = {
    companyUnderstanding:
      profile.name && profile.websiteUrl && profile.shortOverview ? 100 : 45,
    commercialStructure: active.length ? (active.length <= 8 ? 100 : 70) : 0,
    offeringDefinition: active.length
      ? Math.round(
          active.reduce(
            (sum, item) =>
              sum + (item.shortDescription && item.valueProposition ? 100 : 60),
            0,
          ) / active.length,
        )
      : 0,
    sourceReliability: profile.research.sources.length
      ? profile.research.sources.some((item) => item.confidence === "high")
        ? 100
        : 70
      : 35,
    messagingSafety:
      profile.companyProof.some((item) => item.approvedForOutreach) ||
      (profile.commercialConstraints?.length ?? 0) ||
      (profile.regulatoryLimitations?.length ?? 0)
        ? 100
        : 55,
  };
  return {
    ...scores,
    overall: Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0) / 5),
  };
}

export function mergeUserPreferences(
  analyzed: StructuredCompanyProfile,
  current: StructuredCompanyProfile | null,
): StructuredCompanyProfile {
  if (!current) return analyzed;
  const currentByName = new Map(
    current.offerings.map((item) => [item.name.trim().toLowerCase(), item]),
  );
  const offerings = analyzed.offerings.map((item) => {
    const saved =
      currentByName.get(item.name.trim().toLowerCase()) ??
      bestOfferingMatch(item, current.offerings);
    return saved
      ? {
          ...item,
          buyerPersonas: saved.buyerPersonas,
          commercialConstraints: saved.commercialConstraints,
          disqualifyingConditions: saved.disqualifyingConditions,
          priority: saved.priority,
          prospectingMarkets: saved.prospectingMarkets,
          qualificationRequirements: saved.qualificationRequirements,
          status: saved.status,
          targetCompanySizes: saved.targetCompanySizes,
          targetCustomerTypes: saved.targetCustomerTypes,
          targetIndustries: saved.targetIndustries,
        }
      : item;
  });
  const merged = {
    ...analyzed,
    communicationRules: current.communicationRules,
    excludedMarkets: current.excludedMarkets,
    outreachLanguages: current.outreachLanguages,
    prospectingMarkets: current.prospectingMarkets,
    commercialConstraints: [
      ...new Set([
        ...(analyzed.commercialConstraints ?? []),
        ...(current.commercialConstraints ?? []),
      ]),
    ],
    offerings,
  };
  return { ...merged, readiness: calculateReadiness(merged) };
}

function bestOfferingMatch(candidate: Offering, existing: Offering[]) {
  const candidateTerms = terms(
    [candidate.name, ...(candidate.productCategories ?? [])].join(" "),
  );
  let best: Offering | undefined;
  let bestScore = 0;
  for (const item of existing) {
    const itemTerms = terms([item.name, ...(item.productCategories ?? [])].join(" "));
    const overlap = [...candidateTerms].filter((term) => itemTerms.has(term)).length;
    const score = overlap / Math.max(candidateTerms.size, itemTerms.size, 1);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return bestScore >= 0.35 ? best : undefined;
}

function terms(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((item) => item.length > 3),
  );
}

function parseOffering(value: unknown): Offering {
  if (!isRecord(value)) throw new Error("Invalid offering.");
  const buyerPersonas = array(value.buyerPersonas, "buyerPersonas").map((item) => {
    if (!isRecord(item)) throw new Error("Invalid buyer persona.");
    const titleGroup = requiredString(item.titleGroup, "buyerPersona.titleGroup");
    const exampleTitles = stringArray(item.exampleTitles, "buyerPersona.exampleTitles");
    if (!exampleTitles.length)
      throw new Error(`Buyer persona ${titleGroup} has no titles.`);
    return {
      titleGroup,
      exampleTitles,
      ...(optionalString(item.reasonToContact)
        ? { reasonToContact: optionalString(item.reasonToContact) }
        : {}),
      ...(typeof item.roleInDecision === "string"
        ? { roleInDecision: item.roleInDecision as BuyerPersona["roleInDecision"] }
        : {}),
    };
  });
  const model = requiredString(value.businessModel, "offering.businessModel");
  if (!businessModelTypes.includes(model as BusinessModelType))
    throw new Error(`Unsupported offering business model: ${model}.`);
  return {
    id: id(value.id, "offering.id"),
    name: requiredString(value.name, "offering.name"),
    offeringType: requiredString(value.offeringType, "offering.offeringType"),
    businessModel: model as BusinessModelType,
    shortDescription: requiredString(
      value.shortDescription,
      "offering.shortDescription",
      true,
    ),
    customerProblems: stringArray(value.customerProblems, "customerProblems"),
    expectedOutcomes: stringArray(value.expectedOutcomes, "expectedOutcomes"),
    useCases: stringArray(value.useCases, "useCases"),
    targetCustomerTypes: stringArray(value.targetCustomerTypes, "targetCustomerTypes"),
    targetIndustries: stringArray(value.targetIndustries, "targetIndustries"),
    targetCompanySizes: stringArray(value.targetCompanySizes, "targetCompanySizes"),
    buyerPersonas,
    currentMarkets: stringArray(value.currentMarkets, "currentMarkets"),
    prospectingMarkets: stringArray(value.prospectingMarkets, "prospectingMarkets"),
    qualificationRequirements: stringArray(
      value.qualificationRequirements,
      "qualificationRequirements",
    ),
    disqualifyingConditions: stringArray(
      value.disqualifyingConditions,
      "disqualifyingConditions",
    ),
    commercialConstraints: stringArray(
      value.commercialConstraints,
      "commercialConstraints",
    ),
    supportingCapabilityIds: stringArray(
      value.supportingCapabilityIds,
      "supportingCapabilityIds",
    ),
    productCategories: stringArray(value.productCategories ?? [], "productCategories"),
    supportingProofIds: stringArray(value.supportingProofIds, "supportingProofIds"),
    adaptiveFields: isRecord(value.adaptiveFields)
      ? (value.adaptiveFields as Record<string, string | string[]>)
      : {},
    priority: enumValue(value.priority, ["primary", "secondary", "inactive"], "priority"),
    status: enumValue(value.status, ["detected", "confirmed", "excluded"], "status"),
    sourceReferences: array(value.sourceReferences, "sourceReferences").map(parseSource),
    ...optionalOfferingFields(value),
  };
}

function parseCapability(value: unknown): Capability {
  if (!isRecord(value)) throw new Error("Invalid capability.");
  return {
    id: id(value.id, "capability.id"),
    name: requiredString(value.name, "capability.name"),
    relatedOfferingIds: stringArray(value.relatedOfferingIds, "relatedOfferingIds"),
    ...(optionalString(value.description)
      ? { description: optionalString(value.description) }
      : {}),
    ...(Array.isArray(value.evidence)
      ? { evidence: stringArray(value.evidence, "capability.evidence") }
      : {}),
    ...(value.confidence
      ? {
          confidence: enumValue(
            value.confidence,
            ["high", "medium", "low"],
            "capability.confidence",
          ) as ProfileConfidence,
        }
      : {}),
    ...(value.status
      ? {
          status: enumValue(
            value.status,
            ["confirmed", "inferred", "rejected"],
            "capability.status",
          ) as Capability["status"],
        }
      : {}),
  };
}

function parseBusinessContext(
  value: unknown,
  capabilityIds: ReadonlySet<string>,
): CompanyProfileBusinessContext {
  const row = isRecord(value) ? value : {};
  const currentCustomerGroups = array(
    row.currentCustomerGroups ?? [],
    "businessContext.currentCustomerGroups",
  ).map((item) => {
    if (!isRecord(item)) throw new Error("Invalid current customer group.");
    return {
      id: id(item.id, "currentCustomerGroup.id"),
      name: requiredString(item.name, "currentCustomerGroup.name"),
      kind: enumValue(
        item.kind,
        [
          "consumer",
          "business",
          "public_institution",
          "partner",
          "distributor",
          "reseller",
          "supplier",
          "contractor",
          "other",
        ],
        "currentCustomerGroup.kind",
      ),
      evidence: stringArray(item.evidence ?? [], "currentCustomerGroup.evidence"),
      confidence: enumValue(
        item.confidence,
        ["high", "medium", "low"],
        "currentCustomerGroup.confidence",
      ),
    };
  });
  const potentialB2BApplications = array(
    row.potentialB2BApplications ?? [],
    "businessContext.potentialB2BApplications",
  ).map((item) => {
    if (!isRecord(item)) throw new Error("Invalid potential B2B application.");
    const supportedByCapabilityIds = stringArray(
      item.supportedByCapabilityIds ?? [],
      "potentialB2BApplication.supportedByCapabilityIds",
    );
    invalidRelations(supportedByCapabilityIds, capabilityIds, "capability");
    return {
      id: id(item.id, "potentialB2BApplication.id"),
      name: requiredString(item.name, "potentialB2BApplication.name"),
      description: requiredString(
        item.description,
        "potentialB2BApplication.description",
      ),
      supportedByCapabilityIds,
      confidence: enumValue(
        item.confidence,
        ["high", "medium", "low"],
        "potentialB2BApplication.confidence",
      ),
      requiresConfirmation: item.requiresConfirmation !== false,
    };
  });
  const unresolvedQuestions = array(
    row.unresolvedQuestions ?? [],
    "businessContext.unresolvedQuestions",
  )
    .map(parseClarificationQuestion)
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 3);
  return {
    businessModel: enumValue(
      row.businessModel ?? "unclear",
      ["b2b", "b2c", "b2g", "mixed", "unclear"],
      "businessContext.businessModel",
    ),
    currentCustomerGroups,
    potentialB2BApplications,
    unresolvedQuestions,
  };
}

function parseClarificationQuestion(value: unknown): ClarificationQuestion {
  if (!isRecord(value)) throw new Error("Invalid clarification question.");
  return {
    id: id(value.id, "clarificationQuestion.id"),
    question: requiredString(value.question, "clarificationQuestion.question"),
    reason: requiredString(value.reason, "clarificationQuestion.reason"),
    impact: enumValue(
      value.impact,
      [
        "offering_definition",
        "business_model",
        "target_segment",
        "delivery_constraint",
        "discovery_feasibility",
      ],
      "clarificationQuestion.impact",
    ),
    answerType: enumValue(
      value.answerType,
      ["single_select", "multi_select", "short_text", "boolean"],
      "clarificationQuestion.answerType",
    ),
    ...(Array.isArray(value.options)
      ? {
          options: value.options.slice(0, 6).map((option) => {
            if (!isRecord(option)) throw new Error("Invalid clarification option.");
            return {
              id: id(option.id, "clarificationOption.id"),
              label: requiredString(option.label, "clarificationOption.label"),
              ...(optionalString(option.description)
                ? { description: optionalString(option.description) }
                : {}),
            };
          }),
        }
      : {}),
    required: value.required === true,
    skippable: value.skippable !== false,
    priority: nonNegativeInteger(value.priority),
  };
}

function parseProof(value: unknown): ProofPoint {
  if (!isRecord(value)) throw new Error("Invalid proof point.");
  return {
    id: id(value.id, "proof.id"),
    type: enumValue(
      value.type,
      [
        "company_metric",
        "certification",
        "facility",
        "case_study",
        "customer_reference",
        "testimonial",
        "quantified_result",
        "investment",
        "strategic_investment",
        "operational_evidence",
      ],
      "proof.type",
    ),
    title: requiredString(value.title, "proof.title"),
    relatedOfferingIds: stringArray(value.relatedOfferingIds, "relatedOfferingIds"),
    approvedForOutreach: value.approvedForOutreach === true,
    sourceReferences: array(value.sourceReferences, "sourceReferences").map(parseSource),
    ...(optionalString(value.value) ? { value: optionalString(value.value) } : {}),
    ...(optionalString(value.description)
      ? { description: optionalString(value.description) }
      : {}),
  };
}

function parseCommercialItem(value: unknown): CommercialItem {
  if (!isRecord(value)) throw new Error("Invalid commercial item.");
  return {
    id: id(value.id, "commercialItem.id"),
    name: requiredString(value.name, "commercialItem.name"),
    classification: enumValue(
      value.classification,
      [
        "offering",
        "product_category",
        "capability",
        "supporting_service",
        "business_model",
        "relationship_model",
        "feature",
        "irrelevant",
      ],
      "commercialItem.classification",
    ),
    relatedOfferingIds: stringArray(
      value.relatedOfferingIds ?? [],
      "commercialItem.relatedOfferingIds",
    ),
    sourceReferences: array(
      value.sourceReferences ?? [],
      "commercialItem.sourceReferences",
    ).map(parseSource),
    ...(optionalString(value.description)
      ? { description: optionalString(value.description) }
      : {}),
  };
}

function parseDifferentiator(value: unknown): Differentiator {
  if (!isRecord(value)) throw new Error("Invalid differentiator.");
  return {
    id: id(value.id, "differentiator.id"),
    title: requiredString(value.title, "differentiator.title"),
    scope: enumValue(value.scope, ["company", "offering"], "differentiator.scope"),
    relatedOfferingIds: stringArray(
      value.relatedOfferingIds ?? [],
      "differentiator.relatedOfferingIds",
    ),
    sourceReferences: array(
      value.sourceReferences ?? [],
      "differentiator.sourceReferences",
    ).map(parseSource),
  };
}

function parseCustomerLandscape(value: unknown): CustomerLandscape {
  const row = isRecord(value) ? value : {};
  return {
    customerTypes: stringArray(row.customerTypes ?? [], "customerTypes"),
    buyerIndustries: stringArray(row.buyerIndustries ?? [], "buyerIndustries"),
    customerNeeds: stringArray(row.customerNeeds ?? [], "customerNeeds"),
    relationshipTypes: stringArray(row.relationshipTypes ?? [], "relationshipTypes"),
    existingMarkets: stringArray(row.existingMarkets ?? [], "existingMarkets"),
    potentialMarkets: stringArray(row.potentialMarkets ?? [], "potentialMarkets"),
  };
}

function parseCustomer(value: unknown): CustomerReference {
  if (!isRecord(value)) throw new Error("Invalid customer reference.");
  return {
    id: id(value.id, "customer.id"),
    companyName: requiredString(value.companyName, "customer.companyName"),
    isPublic: value.isPublic === true,
    approvedForOutreach: value.approvedForOutreach === true,
    sourceReferences: array(value.sourceReferences, "sourceReferences").map(parseSource),
    ...(optionalString(value.industry)
      ? { industry: optionalString(value.industry) }
      : {}),
    ...(optionalString(value.relationshipType)
      ? { relationshipType: optionalString(value.relationshipType) }
      : {}),
    ...(optionalString(value.relatedOfferingId)
      ? { relatedOfferingId: optionalString(value.relatedOfferingId) }
      : {}),
  };
}

function parseSource(value: unknown): SourceReference {
  if (!isRecord(value)) throw new Error("Invalid source reference.");
  const source: SourceReference = {
    extractedAt: requiredString(value.extractedAt, "source.extractedAt"),
    confidence: enumValue(value.confidence, ["high", "medium", "low"], "confidence"),
    origin: enumValue(value.origin, ["explicit", "inferred", "user_provided"], "origin"),
  };
  if (optionalString(value.url)) source.url = url(value.url, "source.url");
  if (optionalString(value.pageTitle)) source.pageTitle = optionalString(value.pageTitle);
  if (optionalString(value.extractedText))
    source.extractedText = optionalString(value.extractedText);
  return source;
}

function parseCommunicationRules(value: unknown): CommunicationRules {
  const row = isRecord(value) ? value : {};
  return {
    approvedClaims: stringArray(row.approvedClaims ?? [], "approvedClaims"),
    prohibitedClaims: stringArray(row.prohibitedClaims ?? [], "prohibitedClaims"),
    ...(optionalString(row.tone) ? { tone: optionalString(row.tone) } : {}),
  };
}

function parseReadiness(value: unknown): ProfileReadiness {
  const row = isRecord(value) ? value : {};
  const keys = [
    "companyUnderstanding",
    "commercialStructure",
    "offeringDefinition",
    "sourceReliability",
    "messagingSafety",
    "overall",
  ] as const;
  return Object.fromEntries(
    keys.map((key) => [key, score(row[key])]),
  ) as ProfileReadiness;
}

function parseResearch(value: unknown): StructuredCompanyProfile["research"] {
  const row = isRecord(value) ? value : {};
  return {
    pagesAnalyzed: nonNegativeInteger(row.pagesAnalyzed),
    factsExtracted: nonNegativeInteger(row.factsExtracted),
    sources: array(row.sources ?? [], "research.sources").map(parseSource),
  };
}

function optionalOfferingFields(value: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const key of [
    "detailedDescription",
    "valueProposition",
    "pricingModel",
    "typicalDealSize",
    "typicalSalesCycle",
  ])
    if (optionalString(value[key])) result[key] = optionalString(value[key])!;
  return result;
}

function optionalStringFields<T extends object>(
  target: T,
  source: Record<string, unknown>,
  keys: string[],
) {
  const row = target as Record<string, unknown>;
  for (const key of keys)
    if (optionalString(source[key])) row[key] = optionalString(source[key]);
}

function uniqueIds(items: Array<{ id: string }>, label: string) {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error(`Duplicate ${label} IDs.`);
}
function deduplicateByTitle<T extends { title: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function invalidRelations(values: string[], allowed: ReadonlySet<string>, label: string) {
  if (values.some((value) => !allowed.has(value)))
    throw new Error(`Invalid related ${label} ID.`);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}.`);
  return value;
}
function stringArray(value: unknown, field: string): string[] {
  return array(value, field)
    .map((item) => requiredString(item, field))
    .filter((item, index, all) => all.indexOf(item) === index);
}
function requiredString(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()))
    throw new Error(`Invalid ${field}.`);
  return value.trim().slice(0, 5000);
}
function optionalString(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 5000)
    : undefined;
}
function url(value: unknown, field: string) {
  const parsed = new URL(requiredString(value, field));
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error(`Invalid ${field}.`);
  return parsed.toString();
}
function id(value: unknown, field: string) {
  const result = requiredString(value, field);
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(result)) throw new Error(`Invalid ${field}.`);
  return result;
}
function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error(`Invalid ${field}.`);
  return value as T;
}
function status(value: unknown): StructuredCompanyProfile["status"] {
  return enumValue(value, ["draft", "needs_input", "ready", "published"], "status");
}
function score(value: unknown) {
  return typeof value === "number" && value >= 0 && value <= 100 ? Math.round(value) : 0;
}
function nonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

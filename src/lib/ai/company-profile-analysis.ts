import {
  calculateReadiness,
  mergeUserPreferences,
  parseStructuredCompanyProfile,
  type ExtractedProfileFact,
  type ReviewQuestion,
  type StructuredCompanyProfile,
} from "../company-profile/structured-profile.ts";
import { generateText } from "../providers/openrouter.ts";

export const companyProfileAnalysisPromptVersion = "company-profile-website-v3-grouped";

export type CompanyProfileAnalysis = {
  facts: ExtractedProfileFact[];
  profile: StructuredCompanyProfile;
  reviewQuestions: ReviewQuestion[];
};

export async function analyzeCompanyProfile(input: {
  currentProfile: Record<string, unknown>;
  sources: Array<{ title: string; url: string; content: string }>;
}) {
  const rawOutput = await generateText(
    [
      {
        role: "system",
        content: [
          "Extract atomic commercial facts from supplied public website evidence, then build a grouped structured company draft.",
          "First classify every commercial item as offering, product_category, capability, supporting_service, business_model, relationship_model, feature, or irrelevant. Then group related items into a small set of campaign-worthy offerings.",
          "An offering must be a meaningful proposition with its own customers, value proposition, and potential campaign. Product ranges, dosage forms, skills, methods, features, and delivery steps are not automatically offerings.",
          "Attach product categories and supporting capabilities to offerings. For a complex manufacturer, prefer roughly 3-5 coherent offerings over 12-15 fragments.",
          "Keep customer types, buyer industries, customer needs, relationship types, existing markets, and potential markets separate.",
          "Keep company and offering differentiators separate from categorized credibility proof. Company metrics are never case studies.",
          "Separate verified claims, strategic direction, commercial constraints, regulatory limitations, and unverified or conflicting information.",
          "Separate headquarters, operating markets, export markets, prospecting markets, supported company languages, and outreach languages. Never infer user strategy fields such as prospecting markets or outreach languages from website presence.",
          "Do not invent customers, metrics, certifications, buyer roles, prospecting preferences, claims, or commercial constraints.",
          "Questions are only for genuine conflicts, low-confidence commercial inference, ambiguous grouping, search/qualification/persona/claim impact, user strategy, or information unavailable from the website.",
          "After successful analysis, generate no mandatory questions unless no usable offering can be produced or a critical source conflict makes the company identity or structure unusable.",
          "Never ask profile-stage questions about target markets, buyer personas, campaign relationship types, qualification strategy, messaging, or per-item standalone status. At most propose one optional grouped offering review plus genuine source conflicts.",
          "Safe explicit proof may be approved for outreach; inferred or conflicting proof must not be approved.",
          "Produce a concise commercially useful overview covering company kind, propositions, business models, general customers, markets, and commercial significance.",
          "Return JSON only and use stable lowercase slug IDs unique within each collection.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          currentStructuredProfile: input.currentProfile.structured_profile ?? null,
          sources: input.sources,
          requiredShape: groupedCompactAnalysisShape,
        }),
      },
    ],
    {
      jsonMode: true,
      maxCompletionTokens: 3_000,
      reasoningEffort: "none",
      taskName: "structured company profile website analysis",
    },
  );
  const parsed = parseCompanyProfileAnalysis(rawOutput);
  const current = input.currentProfile.structured_profile
    ? parseStructuredCompanyProfile(input.currentProfile.structured_profile)
    : null;
  const profile = mergeUserPreferences(parsed.profile, current);
  return {
    analysis: {
      ...parsed,
      profile: { ...profile, readiness: calculateReadiness(profile) },
    },
    rawOutput,
  };
}

export function parseCompanyProfileAnalysis(rawOutput: string): CompanyProfileAnalysis {
  const parsedValue = parseCompleteJsonObject(rawOutput);
  if (parsedValue === undefined) {
    throw new Error("Company Profile analysis returned invalid JSON.");
  }
  const value = unwrapAnalysisRoot(parsedValue);
  if (!isRecord(value))
    throw new Error("Company Profile analysis returned an invalid object.");
  const profile = isRecord(value.profile)
    ? parseStructuredCompanyProfile(value.profile)
    : Array.isArray(value.offerings)
      ? buildStructuredProfileFromGroupedAnalysis(value)
      : buildStructuredProfileFromCompactAnalysis(value);
  const facts = Array.isArray(value.facts)
    ? parseFacts(value.facts)
    : deriveFactsFromProfile(profile);
  const suppliedQuestions = Array.isArray(value.reviewQuestions)
    ? parseQuestions(value.reviewQuestions)
    : [];
  const reviewQuestions = generateMeaningfulReviewQuestions(profile, suppliedQuestions);
  return {
    facts,
    profile: {
      ...profile,
      readiness: calculateReadiness(profile),
      research: { ...profile.research, factsExtracted: facts.length },
      status: reviewQuestions.some(
        (question) =>
          question.priority === "blocking" && question.status === "unanswered",
      )
        ? "needs_input"
        : "ready",
    },
    reviewQuestions,
  };
}

function unwrapAnalysisRoot(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current === "string") {
      try {
        current = JSON.parse(current) as unknown;
        continue;
      } catch {
        return current;
      }
    }
    if (Array.isArray(current)) {
      if (current.length !== 1) return current;
      current = current[0];
      continue;
    }
    if (!isRecord(current)) return current;
    const row = current;
    if (
      "companyName" in row ||
      "profile" in row ||
      "offerings" in row ||
      "productsAndServices" in row
    )
      return row;
    const wrapper = ["analysis", "result", "data", "companyProfile"].find((key) =>
      isRecord(row[key]),
    );
    if (!wrapper) return row;
    current = row[wrapper];
  }
  return current;
}

export function parseCompleteJsonObject(rawOutput: string): unknown {
  const normalized = rawOutput.trim().replace(/^\uFEFF/, "");
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    // NVIDIA reasoning models may put prose or reasoning before the JSON.
  }

  for (
    let start = normalized.indexOf("{");
    start >= 0;
    start = normalized.indexOf("{", start + 1)
  ) {
    const candidate = balancedObjectAt(normalized, start);
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // A nested object may appear before the complete response object.
    }
  }
  return undefined;
}

function balancedObjectAt(input: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < input.length; index += 1) {
    const character = input[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(start, index + 1);
    }
  }
  return null;
}

function buildStructuredProfileFromGroupedAnalysis(
  value: Record<string, unknown>,
): StructuredCompanyProfile {
  const websiteUrl = validUrl(required(value.website, "website"));
  const extractedAt = new Date().toISOString();
  const sourceRows = Array.isArray(value.sources) ? value.sources : [];
  const sources = sourceRows
    .map((item) => {
      if (typeof item === "string")
        return {
          url: validUrl(item),
          extractedAt,
          confidence: "high" as const,
          origin: "explicit" as const,
        };
      if (!isRecord(item) || typeof item.url !== "string") return null;
      return {
        url: validUrl(item.url),
        ...(typeof item.title === "string" ? { pageTitle: item.title.trim() } : {}),
        ...(typeof item.passage === "string"
          ? { extractedText: item.passage.trim().slice(0, 500) }
          : {}),
        extractedAt,
        confidence: oneOf(
          item.confidence ?? "high",
          ["high", "medium", "low"] as const,
          "source.confidence",
        ),
        origin: "explicit" as const,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const sourceReferences = sources.length
    ? sources
    : [
        {
          url: websiteUrl,
          extractedAt,
          confidence: "medium" as const,
          origin: "explicit" as const,
        },
      ];
  const offeringRows = Array.isArray(value.offerings) ? value.offerings : [];
  const capabilities = optionalStrings(value.capabilities);
  const capabilityObjects = capabilities.map((name, index) => ({
    id: indexedStableId(name, "capability", index),
    name,
    relatedOfferingIds: [] as string[],
  }));
  const offerings = offeringRows.map((item, index) => {
    if (!isRecord(item)) throw new Error("Invalid grouped offering.");
    const name = required(item.name, "offering.name");
    const id = indexedStableId(name, "offering", index);
    const supportingNames = optionalStrings(item.supportingCapabilities);
    const supportingCapabilityIds = supportingNames.map((capabilityName) => {
      let capability = capabilityObjects.find(
        (entry) => entry.name.toLowerCase() === capabilityName.toLowerCase(),
      );
      if (!capability) {
        capability = {
          id: indexedStableId(capabilityName, "capability", capabilityObjects.length),
          name: capabilityName,
          relatedOfferingIds: [],
        };
        capabilityObjects.push(capability);
      }
      capability.relatedOfferingIds.push(id);
      return capability.id;
    });
    const model = normalizeBusinessModel(item.businessModel);
    return {
      id,
      name,
      offeringType:
        typeof item.offeringType === "string" ? item.offeringType : "offering",
      businessModel: model,
      shortDescription:
        typeof item.description === "string" ? item.description.trim() : name,
      valueProposition:
        typeof item.valueProposition === "string" ? item.valueProposition.trim() : "",
      customerProblems: optionalStrings(item.customerProblems),
      expectedOutcomes: optionalStrings(item.expectedOutcomes),
      useCases: optionalStrings(item.useCases),
      targetCustomerTypes: optionalStrings(item.customerTypes),
      targetIndustries: optionalStrings(item.industries),
      targetCompanySizes: [],
      buyerPersonas: optionalStrings(item.suggestedBuyerPersonas).map((title) => ({
        titleGroup: title,
        exampleTitles: [title],
      })),
      currentMarkets: [],
      prospectingMarkets: [],
      qualificationRequirements: [],
      disqualifyingConditions: [],
      commercialConstraints: optionalStrings(item.constraints),
      supportingCapabilityIds,
      productCategories: optionalStrings(item.productCategories),
      supportingProofIds: [],
      adaptiveFields: {},
      priority: index === 0 ? "primary" : "secondary",
      status: "detected",
      sourceReferences,
    };
  });
  const landscape = isRecord(value.customerLandscape) ? value.customerLandscape : {};
  const marketData = isRecord(value.markets) ? value.markets : {};
  const proofRows = Array.isArray(value.proof) ? value.proof : [];
  const differentiatorRows = Array.isArray(value.differentiators)
    ? value.differentiators
    : [];
  return parseStructuredCompanyProfile({
    schemaVersion: 2,
    name: required(value.companyName, "companyName"),
    websiteUrl,
    shortOverview: required(value.overview, "overview"),
    sellerIndustries: optionalStrings(value.sellerIndustries),
    businessModels: optionalStrings(value.businessModels).length
      ? optionalStrings(value.businessModels).map(normalizeBusinessModel)
      : ["other"],
    headquarters:
      typeof marketData.headquarters === "string" ? marketData.headquarters : undefined,
    operatingMarkets: optionalStrings(marketData.operatingMarkets),
    exportMarkets: optionalStrings(marketData.exportMarkets),
    prospectingMarkets: [],
    excludedMarkets: [],
    supportedLanguages: optionalStrings(marketData.companyLanguages),
    outreachLanguages: [],
    capabilities: capabilityObjects,
    commercialItems: [],
    customerLandscape: {
      customerTypes: optionalStrings(landscape.customerTypes),
      buyerIndustries: optionalStrings(landscape.buyerIndustries),
      customerNeeds: optionalStrings(landscape.customerNeeds),
      relationshipTypes: optionalStrings(landscape.relationshipTypes),
      existingMarkets: optionalStrings(marketData.operatingMarkets),
      potentialMarkets: optionalStrings(landscape.potentialMarkets),
    },
    differentiators: differentiatorRows.map((item, index) => ({
      id: indexedStableId(
        isRecord(item) ? String(item.title ?? "Differentiator") : String(item),
        "differentiator",
        index,
      ),
      title: isRecord(item) ? required(item.title, "differentiator.title") : String(item),
      scope: "company",
      relatedOfferingIds: [],
      sourceReferences,
    })),
    companyProof: proofRows.map((item, index) => {
      const row = isRecord(item) ? item : { title: String(item) };
      return {
        id: indexedStableId(String(row.title ?? "Proof"), "proof", index),
        type: typeof row.category === "string" ? row.category : "operational_evidence",
        title: required(row.title, "proof.title"),
        relatedOfferingIds: [],
        approvedForOutreach: row.approvedForOutreach === true,
        sourceReferences,
      };
    }),
    existingCustomers: [],
    communicationRules: { approvedClaims: [], prohibitedClaims: [] },
    strategicDirection: optionalStrings(value.strategicDirection),
    verifiedClaims: optionalStrings(value.verifiedClaims),
    commercialConstraints: optionalStrings(value.commercialConstraints),
    regulatoryLimitations: optionalStrings(value.regulatoryLimitations),
    unverifiedInformation: optionalStrings(value.unverifiedInformation),
    offerings,
    status: "draft",
    readiness: {
      companyUnderstanding: 0,
      commercialStructure: 0,
      offeringDefinition: 0,
      sourceReliability: 0,
      messagingSafety: 0,
      overall: 0,
    },
    research: {
      pagesAnalyzed: sourceReferences.length,
      factsExtracted: 0,
      sources: sourceReferences,
    },
  });
}

function buildStructuredProfileFromCompactAnalysis(
  value: Record<string, unknown>,
): StructuredCompanyProfile {
  const websiteUrl = validUrl(required(value.website, "website"));
  const products = stringList(value.productsAndServices, "productsAndServices");
  const capabilities = stringList(value.capabilities, "capabilities");
  const customerTypes = stringList(value.customerTypes, "customerTypes");
  const markets = stringList(value.marketsAndLanguages, "marketsAndLanguages");
  const proof = [
    ...stringList(value.differentiators, "differentiators"),
    ...stringList(value.proofPoints, "proofPoints"),
  ];
  const sourceUrls = stringList(value.sources, "sources");
  const extractedAt = new Date().toISOString();
  const sourceReferences = (sourceUrls.length ? sourceUrls : [websiteUrl]).map((url) => ({
    url: validUrl(url),
    extractedAt,
    confidence: "high" as const,
    origin: "explicit" as const,
  }));

  return parseStructuredCompanyProfile({
    schemaVersion: 2,
    name: required(value.companyName, "companyName"),
    websiteUrl,
    shortOverview: required(value.summary, "summary"),
    sellerIndustries: [],
    businessModels: ["other"],
    operatingMarkets: markets,
    exportMarkets: [],
    prospectingMarkets: [],
    excludedMarkets: [],
    supportedLanguages: [],
    outreachLanguages: [],
    capabilities: capabilities.map((name, index) => ({
      id: indexedStableId(name, "capability", index),
      name,
      description: name,
      relatedOfferingIds: [],
    })),
    commercialItems: [],
    customerLandscape: {
      customerTypes,
      buyerIndustries: [],
      customerNeeds: [],
      relationshipTypes: [],
      existingMarkets: markets,
      potentialMarkets: [],
    },
    differentiators: [],
    companyProof: proof.map((title, index) => ({
      id: indexedStableId(title, "proof", index),
      type: "operational_evidence",
      title,
      relatedOfferingIds: [],
      approvedForOutreach: false,
      sourceReferences,
    })),
    existingCustomers: [],
    communicationRules: { approvedClaims: [], prohibitedClaims: [] },
    strategicDirection: [],
    verifiedClaims: stringList(value.claims, "claims"),
    commercialConstraints: stringList(value.limitations, "limitations"),
    regulatoryLimitations: [],
    unverifiedInformation: [],
    offerings: products.map((name, index) => ({
      id: indexedStableId(name, "offering", index),
      name,
      offeringType: "offering",
      businessModel: "other",
      shortDescription: name,
      valueProposition: "",
      customerProblems: [],
      expectedOutcomes: [],
      useCases: [],
      targetCustomerTypes: customerTypes,
      targetIndustries: [],
      targetCompanySizes: [],
      buyerPersonas: [],
      currentMarkets: markets,
      prospectingMarkets: [],
      qualificationRequirements: [],
      disqualifyingConditions: [],
      commercialConstraints: [],
      supportingCapabilityIds: [],
      productCategories: [],
      supportingProofIds: [],
      adaptiveFields: {},
      priority: index === 0 ? "primary" : "secondary",
      status: "detected",
      sourceReferences,
    })),
    status: "draft",
    readiness: {
      companyUnderstanding: 0,
      commercialStructure: 0,
      offeringDefinition: 0,
      sourceReliability: 0,
      messagingSafety: 0,
      overall: 0,
    },
    research: {
      pagesAnalyzed: sourceReferences.length,
      factsExtracted: 0,
      sources: sourceReferences,
    },
  });
}

function stringList(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Invalid ${field}.`);
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function indexedStableId(value: string, prefix: string, index: number) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 52);
  return `${slug || prefix}_${index + 1}`;
}

function deriveFactsFromProfile(
  profile: StructuredCompanyProfile,
): ExtractedProfileFact[] {
  const fallbackSource =
    profile.research.sources[0] ??
    ({
      url: profile.websiteUrl,
      extractedAt: new Date().toISOString(),
      confidence: "medium",
      origin: "inferred",
    } as const);
  return [
    {
      id: "derived_company_name",
      key: "company_name",
      value: profile.name,
      source: fallbackSource,
    },
    ...profile.offerings.map((offering, index) => ({
      id: `derived_offering_${index + 1}`,
      key: "offering",
      value: offering.name,
      offeringName: offering.name,
      source: offering.sourceReferences[0] ?? fallbackSource,
    })),
    ...profile.capabilities.map((capability, index) => ({
      id: `derived_capability_${index + 1}`,
      key: "capability",
      value: capability.name,
      source: fallbackSource,
    })),
  ];
}

export function generateLegacyReviewQuestions(
  profile: StructuredCompanyProfile,
): ReviewQuestion[] {
  const questions: ReviewQuestion[] = [];
  for (const offering of profile.offerings.filter((item) => item.status === "detected")) {
    questions.push({
      id: `confirm_${offering.id}`,
      category: "offering",
      title: `Is “${offering.name}” a standalone offering customers can purchase?`,
      relatedOfferingId: offering.id,
      inputType: "single_select",
      options: [
        { id: "standalone", label: "Yes, it is a standalone offering" },
        { id: "capability", label: "No, it supports other offerings" },
        { id: "remove", label: "Remove it from the profile" },
      ],
      required: true,
      status: "unanswered",
    });
    if (!offering.targetCustomerTypes.length) {
      questions.push({
        id: `customers_${offering.id}`,
        category: "customer",
        title: `Which customer types should “${offering.name}” target?`,
        relatedOfferingId: offering.id,
        inputType: "text",
        required: true,
        status: "unanswered",
      });
    }
    if (!offering.buyerPersonas.length) {
      questions.push({
        id: `buyers_${offering.id}`,
        category: "buyer_persona",
        title: `Who normally owns or influences the decision for “${offering.name}”?`,
        relatedOfferingId: offering.id,
        inputType: "text",
        required: true,
        status: "unanswered",
      });
    }
  }
  if (!profile.prospectingMarkets.length) {
    questions.push({
      id: "prospecting_markets",
      category: "market",
      title: "Which markets should Opptium prioritise for new customers?",
      inputType: "text",
      required: true,
      status: "unanswered",
    });
  }
  return questions;
}

export function generateMeaningfulReviewQuestions(
  profile: StructuredCompanyProfile,
  supplied: ReviewQuestion[] = [],
): ReviewQuestion[] {
  const questions: ReviewQuestion[] = [];
  if (profile.offerings.length === 0) {
    questions.push({
      id: "missing_commercial_structure",
      stage: "profile_blocking",
      category: "offering",
      title: "We could not identify a usable commercial offering.",
      description:
        "Explain what the company sells before creating a campaign, or analyse a clearer source.",
      inputType: "text",
      required: true,
      priority: "blocking",
      status: "unanswered",
    });
  } else if (profile.offerings.some((item) => item.status === "detected")) {
    questions.push({
      id: "review_offering_structure",
      stage: "profile_optional",
      category: "offering",
      title: `Review the proposed grouping of ${profile.offerings.length} offerings`,
      description: profile.offerings.map((item) => item.name).join(" · "),
      fieldPath: "offerings.structure",
      inputType: "single_select",
      options: [
        { id: "confirm", label: "Confirm grouping" },
        { id: "edit", label: "Edit grouping" },
      ],
      required: false,
      priority: "optional",
      status: "unanswered",
    });
  }
  for (const conflict of supplied.filter(
    (item) => item.category === "conflict" || item.inputType === "resolve_conflict",
  )) {
    if (questions.length >= 4) break;
    questions.push({
      ...conflict,
      stage: conflict.required ? "profile_blocking" : "profile_optional",
      priority: conflict.required ? "blocking" : "optional",
    });
  }
  return questions;
}

export function generatePreviousMeaningfulReviewQuestions(
  profile: StructuredCompanyProfile,
  supplied: ReviewQuestion[] = [],
): ReviewQuestion[] {
  const questions: ReviewQuestion[] = [];
  if (profile.offerings.some((item) => item.status === "detected")) {
    questions.push({
      id: "review_offering_structure",
      category: "offering",
      title: `We grouped the commercial items into ${profile.offerings.length} proposed offerings. Does this reflect how the company sells?`,
      description: profile.offerings
        .map((item) =>
          item.productCategories?.length
            ? `${item.name} (${item.productCategories.join(", ")})`
            : item.name,
        )
        .join(" · "),
      fieldPath: "offerings.structure",
      inputType: "single_select",
      options: [
        { id: "confirm", label: "Confirm structure" },
        { id: "edit", label: "Edit grouping" },
        { id: "manual", label: "Organise manually" },
        { id: "explain", label: "Explain it in my own words" },
      ],
      required: true,
      priority: "blocking",
      status: "unanswered",
    });
  }
  if (profile.offerings.length > 1) {
    questions.push({
      id: "active_offerings",
      category: "offering",
      title: "Which offerings should currently be active for prospecting?",
      fieldPath: "offerings.active",
      inputType: "multi_select",
      options: profile.offerings.map((item) => ({ id: item.id, label: item.name })),
      required: false,
      priority: "important",
      status: "unanswered",
    });
  }
  if (!profile.prospectingMarkets.length) {
    questions.push({
      id: "prospecting_markets",
      category: "market",
      title: "Which markets should Opptium prioritise for prospecting?",
      description: "Website presence is retained separately from sales strategy.",
      fieldPath: "prospectingMarkets",
      inputType: "text",
      required: false,
      priority: "important",
      status: "unanswered",
    });
  }
  if (profile.customerLandscape?.relationshipTypes.length) {
    questions.push({
      id: "priority_relationship_types",
      category: "customer",
      title: "Which relationship types are you currently seeking?",
      fieldPath: "customerLandscape.relationshipTypes",
      inputType: "multi_select",
      options: profile.customerLandscape.relationshipTypes.map((item, index) => ({
        id: indexedStableId(item, "relationship", index),
        label: item,
      })),
      required: false,
      priority: "important",
      status: "unanswered",
    });
  }
  if (
    !profile.offerings.some(
      (item) =>
        item.qualificationRequirements.length || item.commercialConstraints.length,
    )
  ) {
    questions.push({
      id: "commercial_requirements",
      category: "qualification",
      title: "Are there minimum commercial requirements Opptium should know?",
      description: "For example MOQ, required capacity, certifications, or deal size.",
      fieldPath: "commercialConstraints",
      inputType: "text",
      required: false,
      priority: "important",
      status: "unanswered",
    });
  }
  for (const conflict of supplied.filter(
    (item) => item.category === "conflict" || item.inputType === "resolve_conflict",
  )) {
    if (questions.length >= 7) break;
    questions.push({ ...conflict, priority: conflict.priority ?? "blocking" });
  }
  return questions.slice(0, 7);
}

function parseFacts(value: unknown): ExtractedProfileFact[] {
  if (!Array.isArray(value)) throw new Error("Company Profile facts must be an array.");
  const facts = value.map((item) => {
    if (!isRecord(item) || !isRecord(item.source))
      throw new Error("Invalid profile fact.");
    const source = item.source;
    return {
      id: required(item.id, "fact.id"),
      key: required(item.key, "fact.key"),
      value: required(item.value, "fact.value"),
      ...(typeof item.offeringName === "string" && item.offeringName.trim()
        ? { offeringName: item.offeringName.trim() }
        : {}),
      source: {
        ...(typeof source.url === "string" ? { url: validUrl(source.url) } : {}),
        ...(typeof source.pageTitle === "string"
          ? { pageTitle: source.pageTitle.trim() }
          : {}),
        ...(typeof source.extractedText === "string"
          ? { extractedText: source.extractedText.trim().slice(0, 500) }
          : {}),
        extractedAt: required(source.extractedAt, "source.extractedAt"),
        confidence: oneOf(source.confidence, ["high", "medium", "low"], "confidence"),
        origin: oneOf(source.origin, ["explicit", "inferred", "user_provided"], "origin"),
      },
    } satisfies ExtractedProfileFact;
  });
  const deduplicated = new Map<string, ExtractedProfileFact>();
  for (const fact of facts) {
    const key = `${fact.key}:${fact.value.toLowerCase()}:${fact.offeringName?.toLowerCase() ?? ""}`;
    if (!deduplicated.has(key)) deduplicated.set(key, fact);
  }
  return [...deduplicated.values()];
}

function parseQuestions(value: unknown): ReviewQuestion[] {
  if (!Array.isArray(value)) throw new Error("Review questions must be an array.");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Invalid review question.");
    return {
      id: required(item.id, "question.id"),
      category: oneOf(
        item.category,
        [
          "offering",
          "customer",
          "market",
          "buyer_persona",
          "qualification",
          "constraint",
          "claim",
          "conflict",
        ],
        "question.category",
      ),
      title: required(item.title, "question.title"),
      ...(typeof item.description === "string"
        ? { description: item.description.trim() }
        : {}),
      ...(typeof item.fieldPath === "string" ? { fieldPath: item.fieldPath.trim() } : {}),
      ...(typeof item.relatedOfferingId === "string"
        ? { relatedOfferingId: item.relatedOfferingId.trim() }
        : {}),
      inputType: oneOf(
        item.inputType,
        [
          "single_select",
          "multi_select",
          "text",
          "number",
          "confirm",
          "resolve_conflict",
        ],
        "question.inputType",
      ),
      ...(Array.isArray(item.options)
        ? {
            options: item.options.map((option) => {
              if (!isRecord(option)) throw new Error("Invalid question option.");
              return {
                id: required(option.id, "option.id"),
                label: required(option.label, "option.label"),
              };
            }),
          }
        : {}),
      required: item.required === true,
      stage: oneOf(
        item.stage ?? (item.required === true ? "profile_blocking" : "profile_optional"),
        [
          "profile_optional",
          "profile_blocking",
          "campaign",
          "offering_defaults",
        ] as const,
        "question.stage",
      ),
      priority: oneOf(
        item.priority ?? (item.required === true ? "blocking" : "optional"),
        ["blocking", "important", "optional"] as const,
        "question.priority",
      ),
      status: oneOf(
        item.status,
        ["unanswered", "answered", "skipped", "dismissed"],
        "question.status",
      ),
    } satisfies ReviewQuestion;
  });
}

export const structuredAnalysisShape = {
  facts: [
    {
      id: "fact_slug",
      key: "atomic_fact_type",
      value: "value",
      offeringName: "optional",
      source: {
        url: "https://...",
        pageTitle: "title",
        extractedText: "short evidence",
        extractedAt: "ISO timestamp",
        confidence: "high|medium|low",
        origin: "explicit|inferred|user_provided",
      },
    },
  ],
  profile: {
    schemaVersion: 2,
    name: "string",
    websiteUrl: "https://...",
    shortOverview: "string",
    sellerIndustries: ["string"],
    businessModels: [
      "saas_software|professional_service|agency_consultancy|manufacturer|contract_manufacturer|distributor_wholesaler|partnership_licensing|marketplace|other",
    ],
    operatingMarkets: ["string"],
    exportMarkets: ["string"],
    prospectingMarkets: [],
    excludedMarkets: [],
    supportedLanguages: ["string"],
    outreachLanguages: [],
    capabilities: [
      {
        id: "slug",
        name: "string",
        description: "string",
        relatedOfferingIds: ["offering_slug"],
      },
    ],
    commercialItems: [
      {
        id: "slug",
        name: "string",
        classification:
          "offering|product_category|capability|supporting_service|business_model|relationship_model|feature|irrelevant",
        description: "string",
        relatedOfferingIds: ["offering_slug"],
        sourceReferences: [],
      },
    ],
    customerLandscape: {
      customerTypes: ["string"],
      buyerIndustries: ["string"],
      customerNeeds: ["string"],
      relationshipTypes: ["string"],
      existingMarkets: ["string"],
      potentialMarkets: ["string"],
    },
    differentiators: [
      {
        id: "slug",
        title: "string",
        scope: "company|offering",
        relatedOfferingIds: [],
        sourceReferences: [],
      },
    ],
    companyProof: [
      {
        id: "slug",
        type: "company_metric|certification|facility|case_study|customer_reference|testimonial|quantified_result|strategic_investment|operational_evidence",
        title: "string",
        relatedOfferingIds: [],
        approvedForOutreach: true,
        sourceReferences: [],
      },
    ],
    existingCustomers: [],
    communicationRules: { approvedClaims: [], prohibitedClaims: [] },
    strategicDirection: [],
    verifiedClaims: ["string"],
    commercialConstraints: ["string"],
    regulatoryLimitations: ["string"],
    unverifiedInformation: ["string"],
    offerings: [
      {
        id: "slug",
        name: "string",
        offeringType: "string",
        businessModel: "other",
        shortDescription: "string",
        valueProposition: "string",
        customerProblems: [],
        expectedOutcomes: [],
        useCases: [],
        targetCustomerTypes: [],
        targetIndustries: [],
        targetCompanySizes: [],
        buyerPersonas: [],
        currentMarkets: [],
        prospectingMarkets: [],
        qualificationRequirements: [],
        disqualifyingConditions: [],
        commercialConstraints: [],
        supportingCapabilityIds: [],
        productCategories: ["string"],
        supportingProofIds: [],
        adaptiveFields: {},
        priority: "primary|secondary|inactive",
        status: "detected|confirmed|excluded",
        sourceReferences: [],
      },
    ],
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
  },
  reviewQuestions: [
    {
      id: "slug",
      category:
        "offering|customer|market|buyer_persona|qualification|constraint|claim|conflict",
      title: "one decision",
      inputType: "single_select|multi_select|text|number|confirm|resolve_conflict",
      options: [{ id: "slug", label: "string" }],
      required: true,
      stage: "profile_optional|profile_blocking|campaign|offering_defaults",
      priority: "blocking|important|optional",
      status: "unanswered",
    },
  ],
};

const groupedCompactAnalysisShape = {
  companyName: "string",
  website: "company website URL",
  overview: "commercially useful 2-4 sentence overview",
  sellerIndustries: ["string"],
  businessModels: ["supported business model enum"],
  offerings: [
    {
      name: "grouped campaign-worthy proposition",
      description: "string",
      offeringType: "string",
      businessModel: "supported business model enum",
      valueProposition: "string",
      productCategories: ["string"],
      supportingCapabilities: ["string"],
      customerTypes: ["string"],
      industries: ["string"],
      suggestedBuyerPersonas: ["non-binding suggestion"],
      constraints: ["stable known constraint"],
    },
  ],
  capabilities: ["company capability"],
  customerLandscape: {
    customerTypes: ["string"],
    buyerIndustries: ["string"],
    customerNeeds: ["string"],
    relationshipTypes: ["string"],
    potentialMarkets: ["string"],
  },
  markets: {
    headquarters: "string",
    operatingMarkets: ["string"],
    exportMarkets: ["string"],
    companyLanguages: ["string"],
  },
  differentiators: [{ title: "string" }],
  proof: [
    {
      category:
        "company_metric|certification|facility|operational_evidence|customer_reference|case_study|testimonial|quantified_result|strategic_investment",
      title: "string",
      approvedForOutreach: false,
    },
  ],
  verifiedClaims: ["string"],
  strategicDirection: ["string"],
  commercialConstraints: ["string"],
  regulatoryLimitations: ["string"],
  unverifiedInformation: ["string"],
  sources: [
    {
      url: "source URL",
      title: "page title",
      passage: "short supporting passage",
      confidence: "high|medium|low",
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function required(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}.`);
  return value.trim().slice(0, 5000);
}
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error(`Invalid ${field}.`);
  return value as T;
}
function validUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : `https://${value.trim()}`;
  const result = new URL(candidate);
  if (!["http:", "https:"].includes(result.protocol))
    throw new Error("Invalid source URL.");
  return result.toString();
}

function optionalStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeBusinessModel(value: unknown) {
  if (typeof value !== "string") return "other";
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    saas: "saas_software",
    software: "saas_software",
    service: "professional_service",
    services: "professional_service",
    consultancy: "agency_consultancy",
    consulting: "agency_consultancy",
    agency: "agency_consultancy",
    manufacturing: "manufacturer",
    contract_manufacturing: "contract_manufacturer",
    distributor: "distributor_wholesaler",
    distribution: "distributor_wholesaler",
    wholesale: "distributor_wholesaler",
    wholesaler: "distributor_wholesaler",
    licensing: "partnership_licensing",
    partnership: "partnership_licensing",
    partnerships: "partnership_licensing",
  };
  const canonical = new Set([
    "saas_software",
    "professional_service",
    "agency_consultancy",
    "manufacturer",
    "contract_manufacturer",
    "distributor_wholesaler",
    "partnership_licensing",
    "marketplace",
    "other",
  ]);
  return canonical.has(normalized) ? normalized : (aliases[normalized] ?? "other");
}

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  countryDisplayName,
  deriveDiscoveryLanguages,
} from "../../discovery/languages.ts";
import {
  providerDiscoveryRequestSchema,
  type ProviderDiscoveryRequest,
} from "../contracts.ts";
import {
  directoryVocabulary,
  relationshipVocabulary,
} from "./relationship-vocabulary.ts";

export const webDiscoveryQuerySchema = z
  .object({
    id: z.string().min(1),
    campaignId: z.string().min(1),
    discoverySegmentId: z.string().min(1),
    query: z.string().min(1).max(240),
    normalizedQuery: z.string().min(1),
    fingerprint: z.string().length(64),
    family: z.enum([
      "direct_commercial",
      "relationship",
      "product_category",
      "capability",
      "archetype",
      "business_model",
      "positive_signal",
      "use_context",
      "directory",
      "local_language",
      "known_entity_expansion",
      "gap_targeted",
      "source_hint",
    ]),
    sourceFamily: z.enum([
      "company_website",
      "industry_association",
      "trade_association",
      "member_directory",
      "event_exhibitor_list",
      "supplier_directory",
      "partner_directory",
      "public_business_directory",
      "regulatory_certification_list",
      "national_industry_list",
    ]),
    language: z.string().min(1),
    country: z.string().length(2).optional(),
    domains: z.array(z.string()).optional(),
    excludedDomains: z.array(z.string()).optional(),
    purpose: z.string().min(1),
    expectedInformationGain: z.string().min(1).optional(),
    expectedGapId: z.string().min(1).optional(),
    priority: z.number().int().positive(),
    status: z.literal("planned"),
  })
  .strict();

export type WebDiscoveryQuery = z.infer<typeof webDiscoveryQuerySchema>;

export const webQueryPolicyVersion = "web-query/v3-objective-aware";

export function generateWebDiscoveryQueries(
  rawRequest: ProviderDiscoveryRequest,
): WebDiscoveryQuery[] {
  const request = providerDiscoveryRequestSchema.parse(rawRequest);
  const segment = request.segment;
  const roleTerms = relationshipVocabulary(segment.relationshipType);
  const directoryTerms = directoryVocabulary(segment.relationshipType);
  const geography = segment.geography.displayName;
  const countryContexts = segment.geography.countryCodes
    .map((countryCode) => countryCode.trim().toUpperCase())
    .filter((countryCode) => /^[A-Z]{2}$/.test(countryCode))
    .map((countryCode) => ({
      countryCode,
      displayName: countryDisplayName(countryCode),
      localLanguage: deriveDiscoveryLanguages({ countryCodes: [countryCode] }).find(
        (language) => language !== "English",
      ),
    }));
  const maximumQueries = Math.max(1, Math.min(request.budget.maxCalls ?? 6, 10));
  const excludedDomains = request.executionContext.excludedCanonicalKeys
    .map(domainFromCanonicalKey)
    .filter((domain): domain is string => Boolean(domain));
  const excludedTerms = segment.exclusionRules
    .filter(({ ruleKey }) => ruleKey.startsWith("memory.query.exclude."))
    .flatMap(({ description }) => description.split("|"))
    .map((term) => term.trim())
    .filter(Boolean);
  const candidates: Array<
    Pick<
      WebDiscoveryQuery,
      "query" | "family" | "sourceFamily" | "language" | "purpose"
    > & {
      expectedGapId?: string;
      country?: string;
      domains?: string[];
    }
  > = [];
  const targetedActions = request.executionContext.targetedActions ?? [];
  if (targetedActions.length) {
    for (const action of targetedActions) {
      candidates.push(
        ...targetedCandidates({
          action,
          geography,
          segment,
        }).slice(0, action.maxCalls ?? 1),
      );
    }
  } else {
    for (const sourceHint of segment.businessCharacteristics.sourceHints.slice(0, 2)) {
      const sourceDomain = domainFromHint(sourceHint);
      candidates.push({
        query: join([
          segment.label,
          geography,
          sourceDomain ? "members companies directory" : sourceHint,
        ]),
        family: "source_hint",
        sourceFamily: "member_directory",
        language: segment.geography.workingLanguages[0] ?? "English",
        ...(sourceDomain ? { domains: [sourceDomain] } : {}),
        purpose: `Use the named market source for candidate discovery: ${sourceHint}.`,
      });
    }
    for (const signal of segment.businessCharacteristics.commercialSignals.slice(0, 3)) {
      candidates.push({
        query: join([quoted(signal.label), segment.label, geography, roleTerms[0]]),
        family: signal.type === "buying_trigger" ? "positive_signal" : "use_context",
        sourceFamily:
          signal.type === "buying_trigger"
            ? "company_website"
            : "public_business_directory",
        language: segment.geography.workingLanguages[0] ?? "English",
        purpose: `Find ${signal.type.replaceAll("_", " ")} evidence for ${signal.key}.`,
      });
    }
    const contextualLabel = expandContextualAcronyms(segment.label, [
      ...segment.businessCharacteristics.industries,
      ...segment.businessCharacteristics.keywords,
      ...segment.businessCharacteristics.businessModels,
      ...segment.positiveSignals.map(({ label }) => label),
    ]);
    const geographyContexts = countryContexts.length
      ? countryContexts
      : [{ countryCode: undefined, displayName: geography, localLanguage: undefined }];
    const primaryIndustry = segment.businessCharacteristics.industries[0];
    const primaryModel = segment.businessCharacteristics.businessModels[0];
    const primarySignal = segment.positiveSignals[0]?.label;
    if (countryContexts.length > 1) {
      for (const context of countryContexts) {
        candidates.push({
          query: join([
            contextualLabel,
            context.displayName,
            roleTerms[0],
            "official website",
          ]),
          family: "archetype",
          sourceFamily: "company_website",
          language: segment.geography.workingLanguages[0] ?? "English",
          country: context.countryCode,
          purpose: `Find operating organizations in ${context.displayName}.`,
        });
        if (context.localLanguage) {
          const terms = relationshipVocabulary(
            segment.relationshipType,
            context.localLanguage,
          );
          candidates.push({
            query: join([contextualLabel, context.displayName, terms[0], terms[1]]),
            family: "local_language",
            sourceFamily: "national_industry_list",
            language: context.localLanguage,
            country: context.countryCode,
            purpose: `Find local organizations using ${context.localLanguage} terminology.`,
          });
        }
      }
    } else {
      candidates.push({
        query: join([contextualLabel, geography, roleTerms[0], "official website"]),
        family: "archetype",
        sourceFamily: "company_website",
        language: segment.geography.workingLanguages[0] ?? "English",
        purpose: `Find operating organizations matching ${segment.label}.`,
      });
      candidates.push(
        {
          query: join([contextualLabel, roleTerms[0], geography, "company"]),
          family: "direct_commercial",
          sourceFamily: "company_website",
          language: segment.geography.workingLanguages[0] ?? "English",
          purpose: "Find companies through the explicit commercial category and role.",
        },
        {
          query: join([primaryIndustry, ...roleTerms.slice(0, 2), geography]),
          family: "relationship",
          sourceFamily: "company_website",
          language: segment.geography.workingLanguages[0] ?? "English",
          purpose: `Find organizations through the intended ${segment.relationshipType} relationship.`,
        },
        {
          query: join([contextualLabel, primaryIndustry, geography]),
          family: "product_category",
          sourceFamily: "supplier_directory",
          language: segment.geography.workingLanguages[0] ?? "English",
          purpose: "Find organizations through offering-specific category terminology.",
        },
        {
          query: join([
            quoted(primarySignal ?? primaryModel ?? contextualLabel),
            geography,
            roleTerms[0],
          ]),
          family: "capability",
          sourceFamily: "regulatory_certification_list",
          language: segment.geography.workingLanguages[0] ?? "English",
          purpose:
            "Find organizations through a Campaign-supplied capability or certification signal.",
        },
        {
          query: join([contextualLabel, geography, "trade association members"]),
          family: "directory",
          sourceFamily: "trade_association",
          language: segment.geography.workingLanguages[0] ?? "English",
          purpose: "Find trade-association member sources for this segment.",
        },
        {
          query: join([contextualLabel, geography, "exhibitor list"]),
          family: "directory",
          sourceFamily: "event_exhibitor_list",
          language: segment.geography.workingLanguages[0] ?? "English",
          purpose: "Find event exhibitor sources for this segment.",
        },
      );
    }
    for (const localLanguage of segment.geography.localLanguages) {
      const terms = relationshipVocabulary(segment.relationshipType, localLanguage);
      candidates.push({
        query: join([contextualLabel, geography, terms[0], terms[1]]),
        family: "local_language",
        sourceFamily: "national_industry_list",
        language: localLanguage,
        purpose: `Improve coverage using established ${localLanguage} business terminology.`,
      });
    }
    for (const context of geographyContexts) {
      candidates.push({
        query: join([
          contextualLabel,
          context.displayName,
          roleTerms[0],
          "official website",
        ]),
        family: "archetype",
        sourceFamily: "company_website",
        language: segment.geography.workingLanguages[0] ?? "English",
        country: context.countryCode,
        purpose: `Find operating organizations matching ${segment.label} in ${context.displayName}.`,
      });
    }
    for (const context of geographyContexts) {
      if (!context.localLanguage) continue;
      const terms = relationshipVocabulary(
        segment.relationshipType,
        context.localLanguage,
      );
      candidates.push({
        query: join([contextualLabel, context.displayName, terms[0], "official website"]),
        family: "local_language",
        sourceFamily: "company_website",
        language: context.localLanguage,
        country: context.countryCode,
        purpose: `Find operating organizations in ${context.displayName} using established ${context.localLanguage} business terminology.`,
      });
    }
    for (const model of segment.businessCharacteristics.businessModels.slice(0, 2)) {
      candidates.push({
        query: join([model, segment.label, geography, roleTerms[0]]),
        family: "business_model",
        sourceFamily: "company_website",
        language: segment.geography.workingLanguages[0] ?? "English",
        purpose: `Find organizations operating as ${model}.`,
      });
    }
    for (const keyword of [
      ...segment.businessCharacteristics.industries,
      ...segment.businessCharacteristics.keywords,
    ].slice(0, 2)) {
      candidates.push({
        query: join([keyword, segment.label, geography, roleTerms[0]]),
        family: "use_context",
        sourceFamily: "company_website",
        language: segment.geography.workingLanguages[0] ?? "English",
        purpose: `Find organizations in the ${keyword} commercial context.`,
      });
    }
    for (const signal of segment.positiveSignals.slice(0, 2)) {
      candidates.push({
        query: join([quoted(signal.label), segment.label, geography, roleTerms[0]]),
        family: "positive_signal",
        sourceFamily: "company_website",
        language: segment.geography.workingLanguages[0] ?? "English",
        purpose: `Find explicit evidence of ${signal.label}.`,
      });
    }
    candidates.push({
      query: join([segment.label, geography, directoryTerms[0]]),
      family: "directory",
      sourceFamily: "member_directory",
      language: segment.geography.workingLanguages[0] ?? "English",
      purpose: `Find directories or member lists covering ${segment.label}.`,
    });
    for (const language of segment.geography.localLanguages) {
      const terms = relationshipVocabulary(segment.relationshipType, language);
      candidates.push({
        query: join([segment.label, geography, terms[0], terms[1]]),
        family: "local_language",
        sourceFamily: "national_industry_list",
        language,
        purpose: `Improve coverage using established ${language} business terminology.`,
      });
    }
  }

  const previous = new Set(request.executionContext.previousQueryFingerprints);
  const seen = new Set<string>();
  const queries: WebDiscoveryQuery[] = [];
  for (const candidate of candidates) {
    const query = appendExcludedTerms(candidate.query, excludedTerms)
      .slice(0, 240)
      .trim();
    const normalizedQuery = normalizeWebQuery(query);
    const fallbackCountry = countryContexts.length
      ? countryContexts[queries.length % countryContexts.length]
      : undefined;
    const country = candidate.country ?? fallbackCountry?.countryCode;
    const fingerprint = fingerprintWebQuery(normalizedQuery, {
      country,
      language: candidate.language,
    });
    if (
      previous.has(fingerprint) ||
      seen.has(fingerprint) ||
      queries.some((existing) =>
        areNearDuplicateQueries(existing.normalizedQuery, normalizedQuery),
      )
    )
      continue;
    seen.add(fingerprint);
    queries.push(
      webDiscoveryQuerySchema.parse({
        id: fingerprint.slice(0, 24),
        campaignId: request.campaignId,
        discoverySegmentId: segment.id,
        query,
        normalizedQuery,
        fingerprint,
        family: candidate.family,
        sourceFamily: candidate.sourceFamily,
        language: candidate.language,
        ...(country ? { country } : {}),
        ...(candidate.domains?.length ? { domains: candidate.domains } : {}),
        ...(excludedDomains.length ? { excludedDomains } : {}),
        purpose: candidate.purpose,
        expectedInformationGain:
          candidate.expectedGapId ??
          `Evidence for ${segment.relationshipType} coverage in ${country ?? geography}.`,
        ...(candidate.expectedGapId
          ? { expectedGapId: candidate.expectedGapId }
          : request.executionContext.gapId
            ? { expectedGapId: request.executionContext.gapId }
            : {}),
        priority: queries.length + 1,
        status: "planned",
      }),
    );
    if (queries.length >= maximumQueries) break;
  }
  return queries;
}

function appendExcludedTerms(query: string, excludedTerms: string[]) {
  return join([
    query,
    ...[...new Set(excludedTerms)].sort().map((term) => `-${quoted(term)}`),
  ]);
}

function targetedCandidates(input: {
  action: NonNullable<
    ProviderDiscoveryRequest["executionContext"]["targetedActions"]
  >[number];
  geography: string;
  segment: ProviderDiscoveryRequest["segment"];
}) {
  const { action, geography, segment } = input;
  const language = segment.geography.workingLanguages[0] ?? "English";
  const roleTerms = relationshipVocabulary(segment.relationshipType);
  const directoryTerms = directoryVocabulary(segment.relationshipType);
  const industry =
    segment.businessCharacteristics.industries[0] ??
    segment.businessCharacteristics.keywords[0];
  const model = segment.businessCharacteristics.businessModels[0];
  const make = (
    query: string,
    family: WebDiscoveryQuery["family"],
    purpose: string,
    queryLanguage = language,
    sourceFamily: WebDiscoveryQuery["sourceFamily"] = "company_website",
  ) => ({
    query,
    family,
    language: queryLanguage,
    purpose,
    sourceFamily,
    expectedGapId: action.gapId,
  });
  if (action.type === "translate_queries") {
    return segment.geography.localLanguages.flatMap((localLanguage) => {
      const terms = relationshipVocabulary(segment.relationshipType, localLanguage);
      return [
        make(
          join([segment.label, geography, terms[0], terms[1], industry]),
          "local_language",
          `Address ${action.gapId} with ${localLanguage} market terminology.`,
          localLanguage,
          "national_industry_list",
        ),
        make(
          join([industry, geography, ...terms.slice(0, 2), "directory"]),
          "local_language",
          `Search a second ${localLanguage} formulation for ${action.gapId}.`,
          localLanguage,
          "member_directory",
        ),
      ];
    });
  }
  if (action.type === "expand_directory") {
    return [
      make(
        join([segment.label, geography, "trade association member directory"]),
        "directory",
        `Expand association coverage for ${action.gapId}.`,
        language,
        "industry_association",
      ),
      make(
        join([industry, geography, directoryTerms[1]]),
        "directory",
        `Expand relationship-specific directory coverage for ${action.gapId}.`,
        language,
        "member_directory",
      ),
      make(
        join([segment.label, geography, "trade fair exhibitors"]),
        "gap_targeted",
        `Inspect exhibitor lists for ${action.gapId}.`,
        language,
        "event_exhibitor_list",
      ),
      make(
        join([model, geography, "business registry companies"]),
        "gap_targeted",
        `Inspect registry-style sources for ${action.gapId}.`,
        language,
        "public_business_directory",
      ),
    ];
  }
  if (action.type === "narrow_segment") {
    return [
      make(
        join([quoted(industry ?? segment.label), quoted(model ?? ""), geography]),
        "gap_targeted",
        `Narrow the segment around its strongest commercial characteristics for ${action.gapId}.`,
      ),
      make(
        join([
          quoted(segment.positiveSignals[0]?.label ?? segment.label),
          industry,
          geography,
          "company",
        ]),
        "gap_targeted",
        `Narrow the segment around an explicit positive signal for ${action.gapId}.`,
      ),
    ];
  }
  if (action.type === "broaden_segment") {
    return [
      make(
        join([model, geography, "companies list"]),
        "gap_targeted",
        `Broaden the business-model vocabulary for ${action.gapId}.`,
      ),
      make(
        join([industry, geography, "organizations", ...roleTerms.slice(0, 2)]),
        "gap_targeted",
        `Broaden the relationship vocabulary for ${action.gapId}.`,
      ),
    ];
  }
  if (action.type === "expand_from_seed") {
    return [];
  }
  if (action.type === "request_user_clarification" || action.type === "stop_segment") {
    return [];
  }
  return [
    make(
      join([segment.label, industry, geography, ...roleTerms.slice(0, 2)]),
      "gap_targeted",
      `Run a non-duplicate targeted search for ${action.gapId}.`,
    ),
    make(
      join([model, industry, geography, "companies directory"]),
      "gap_targeted",
      `Test an alternate commercial formulation for ${action.gapId}.`,
    ),
    make(
      join([segment.label, geography, directoryTerms[0]]),
      "gap_targeted",
      `Test an alternate organization-source formulation for ${action.gapId}.`,
    ),
  ];
}

/** Expands an acronym only when Campaign Strategy supplies an unambiguous expansion. */
export function expandContextualAcronyms(label: string, contextTerms: string[]) {
  const expansions = contextTerms
    .map((term) => term.trim())
    .filter((term) => term.split(/\s+/).length > 1);
  return label.replace(/\b[A-Z][A-Z0-9]{1,5}\b/g, (acronym) => {
    const matches = expansions.filter(
      (term) =>
        term
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean)
          .map((word) => word[0])
          .join("")
          .toUpperCase() === acronym,
    );
    return matches.length === 1 ? quoted(matches[0]!) : acronym;
  });
}

export function normalizeWebQuery(query: string) {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function areNearDuplicateQueries(left: string, right: string) {
  const leftTokens = significantTokens(left);
  const rightTokens = significantTokens(right);
  if (!leftTokens.size || !rightTokens.size) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union >= 0.82;
}

function significantTokens(value: string) {
  return new Set(
    normalizeWebQuery(value)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(
        (token) =>
          token.length > 2 && !["and", "company", "official", "website"].includes(token),
      ),
  );
}

export function fingerprintWebQuery(
  normalizedQuery: string,
  context: { country?: string; language?: string } = {},
) {
  return createHash("sha256")
    .update(
      [
        `policy=${webQueryPolicyVersion}`,
        normalizedQuery,
        `country=${context.country?.trim().toUpperCase() ?? ""}`,
        `language=${context.language?.trim().toLowerCase() ?? ""}`,
      ].join("|"),
    )
    .digest("hex");
}

function quoted(value: string) {
  const clean = value.replaceAll('"', "").trim();
  return clean.includes(" ") ? `"${clean}"` : clean;
}

function join(values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .replace(/\s+/g, " ");
}

function domainFromCanonicalKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return normalized && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)
    ? normalized
    : undefined;
}

function domainFromHint(value: string) {
  return domainFromCanonicalKey(value);
}

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  providerDiscoveryRequestSchema,
  type ProviderDiscoveryRequest,
} from "../contracts.ts";

export const webDiscoveryQuerySchema = z
  .object({
    id: z.string().min(1),
    campaignId: z.string().min(1),
    discoverySegmentId: z.string().min(1),
    query: z.string().min(1).max(240),
    normalizedQuery: z.string().min(1),
    fingerprint: z.string().length(64),
    family: z.enum([
      "archetype",
      "business_model",
      "positive_signal",
      "use_context",
      "directory",
      "local_language",
      "known_entity_expansion",
      "gap_targeted",
    ]),
    language: z.string().min(1),
    country: z.string().length(2).optional(),
    domains: z.array(z.string()).optional(),
    excludedDomains: z.array(z.string()).optional(),
    purpose: z.string().min(1),
    expectedGapId: z.string().min(1).optional(),
    priority: z.number().int().positive(),
    status: z.literal("planned"),
  })
  .strict();

export type WebDiscoveryQuery = z.infer<typeof webDiscoveryQuerySchema>;

const localBusinessTerms: Record<string, string[]> = {
  Lithuanian: ["įmonė", "tiekėjas", "gamintojas"],
  Latvian: ["uzņēmums", "piegādātājs", "ražotājs"],
  Estonian: ["ettevõte", "tarnija", "tootja"],
  Polish: ["firma", "dostawca", "producent"],
  German: ["Unternehmen", "Anbieter", "Hersteller"],
  French: ["entreprise", "fournisseur", "fabricant"],
  Italian: ["azienda", "fornitore", "produttore"],
  Spanish: ["empresa", "proveedor", "fabricante"],
};

export function generateWebDiscoveryQueries(
  rawRequest: ProviderDiscoveryRequest,
): WebDiscoveryQuery[] {
  const request = providerDiscoveryRequestSchema.parse(rawRequest);
  const segment = request.segment;
  const geography = segment.geography.displayName;
  const country = segment.geography.countryCodes[0];
  const maximumQueries = Math.max(1, Math.min(request.budget.maxCalls ?? 6, 10));
  const candidates: Array<
    Pick<WebDiscoveryQuery, "query" | "family" | "language" | "purpose">
  > = [];
  candidates.push({
    query: join([segment.label, geography, "company"]),
    family: "archetype",
    language: segment.geography.workingLanguages[0] ?? "English",
    purpose: `Find operating organizations matching ${segment.label}.`,
  });
  for (const model of segment.businessCharacteristics.businessModels.slice(0, 2)) {
    candidates.push({
      query: join([model, segment.label, geography, "company"]),
      family: "business_model",
      language: segment.geography.workingLanguages[0] ?? "English",
      purpose: `Find organizations operating as ${model}.`,
    });
  }
  for (const keyword of [
    ...segment.businessCharacteristics.industries,
    ...segment.businessCharacteristics.keywords,
  ].slice(0, 2)) {
    candidates.push({
      query: join([keyword, segment.label, geography, "company"]),
      family: "use_context",
      language: segment.geography.workingLanguages[0] ?? "English",
      purpose: `Find organizations in the ${keyword} commercial context.`,
    });
  }
  for (const signal of segment.positiveSignals.slice(0, 2)) {
    candidates.push({
      query: join([quoted(signal.label), segment.label, geography]),
      family: "positive_signal",
      language: segment.geography.workingLanguages[0] ?? "English",
      purpose: `Find explicit evidence of ${signal.label}.`,
    });
  }
  candidates.push({
    query: join([segment.label, geography, "association members directory"]),
    family: "directory",
    language: segment.geography.workingLanguages[0] ?? "English",
    purpose: `Find directories or member lists covering ${segment.label}.`,
  });
  for (const language of segment.geography.localLanguages) {
    const terms = localBusinessTerms[language];
    if (!terms) continue;
    candidates.push({
      query: join([segment.label, geography, terms[0], terms[1]]),
      family: "local_language",
      language,
      purpose: `Improve coverage using established ${language} business terminology.`,
    });
  }

  const previous = new Set(request.executionContext.previousQueryFingerprints);
  const seen = new Set<string>();
  const queries: WebDiscoveryQuery[] = [];
  for (const candidate of candidates) {
    const query = candidate.query.slice(0, 240).trim();
    const normalizedQuery = normalizeWebQuery(query);
    const fingerprint = fingerprintWebQuery(normalizedQuery);
    if (previous.has(fingerprint) || seen.has(fingerprint)) continue;
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
        language: candidate.language,
        country,
        purpose: candidate.purpose,
        ...(request.executionContext.gapId
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

export function normalizeWebQuery(query: string) {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function fingerprintWebQuery(normalizedQuery: string) {
  return createHash("sha256").update(normalizedQuery).digest("hex");
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

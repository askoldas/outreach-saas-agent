import { z } from "zod";

export const nativeCompanyProfileSourceSetSchema = z
  .object({
    contractVersion: z.literal("company-profile-source-set/v1"),
    kind: z.literal("official_website"),
    primaryWebsiteUrl: z.url(),
    allowedDomains: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type NativeCompanyProfileSourceSet = z.infer<
  typeof nativeCompanyProfileSourceSetSchema
>;

export function createNativeCompanyProfileSeed(input: {
  companyProfileId: string;
  publicName: string;
  websiteUrl: string;
  workspaceId: string;
}) {
  const website = normalizePublicWebsite(input.websiteUrl);
  const canonicalDomain = website.hostname.toLowerCase().replace(/^www\./, "");
  const allowedDomains = [...new Set([website.hostname.toLowerCase(), canonicalDomain])];
  return {
    schemaVersion: 3,
    profileVersionId: input.companyProfileId,
    status: "draft",
    identity: {
      id: `identity-${input.companyProfileId}`,
      workspaceId: input.workspaceId,
      publicName: input.publicName.trim(),
      canonicalDomain,
      tradingNames: [],
      brands: [],
      additionalDomains: [],
      operatingLocations: [],
      marketsServed: [],
      supportedLanguages: [],
    },
    businessModel: {
      primaryRoles: [],
      valueChainPosition: [],
      revenueMechanics: [],
      transactionModels: [],
      deliveryModels: [],
      customerConsumptionModes: [],
      channelModels: [],
      commercialConstraints: [],
      unresolvedCommercialQuestions: [],
    },
    offerings: [],
    buyerArchetypes: [],
    rules: [],
    unresolvedCriticalConflictIds: [],
    sourceSet: nativeCompanyProfileSourceSetSchema.parse({
      contractVersion: "company-profile-source-set/v1",
      kind: "official_website",
      primaryWebsiteUrl: website.toString(),
      allowedDomains,
    }),
  };
}

export function readNativeCompanyProfileSourceSet(
  snapshot: unknown,
): NativeCompanyProfileSourceSet {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("The Company Intelligence draft has no native source set.");
  }
  return nativeCompanyProfileSourceSetSchema.parse(
    (snapshot as Record<string, unknown>).sourceSet,
  );
}

function normalizePublicWebsite(value: string) {
  const candidate = /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : `https://${value.trim()}`;
  const website = new URL(candidate);
  if (!website.hostname || !["http:", "https:"].includes(website.protocol)) {
    throw new Error("A public HTTP or HTTPS company website is required.");
  }
  website.hash = "";
  return website;
}

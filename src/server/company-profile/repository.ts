import { parseStructuredCompanyProfile } from "@/lib/company-profile/structured-profile";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { CompanyProfile } from "@/types/domain";

type VersionRow = {
  id: string;
  version: number;
  company_name: string;
  website_url: string | null;
  summary: string;
  structured_profile: unknown;
  extracted_facts: CompanyProfile["extractedFacts"];
  review_questions: CompanyProfile["reviewQuestions"];
  profile_status: CompanyProfile["profileStatus"];
  readiness_score: number;
  provenance: CompanyProfile["provenance"];
  created_at: string;
  intelligence_version: string;
};

const select = `id,version,company_name,website_url,summary,structured_profile,extracted_facts,review_questions,profile_status,readiness_score,provenance,created_at,intelligence_version`;

export async function getCurrentCompanyProfile(
  workspaceId: string,
): Promise<CompanyProfile> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: profile, error } = await supabase
    .from("company_profiles")
    .select("id,current_version_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Company Profile: ${error.message}`);
  if (!profile)
    throw new Error(
      "Could not load Company Profile: workspace profile container is missing.",
    );
  if (!profile.current_version_id) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("name,website_url")
      .eq("id", workspaceId)
      .single();
    if (workspaceError)
      throw new Error(`Could not initialize Company Profile: ${workspaceError.message}`);
    return emptyProfile(workspace.name, workspace.website_url);
  }
  const { data, error: versionError } = await supabase
    .from("company_profile_versions")
    .select(select)
    .eq("workspace_id", workspaceId)
    .eq("id", profile.current_version_id)
    .maybeSingle();
  if (versionError)
    throw new Error(`Could not load Company Profile version: ${versionError.message}`);
  if (!data)
    throw new Error(
      "Could not load Company Profile version: current version does not exist.",
    );
  return mapVersion(data as VersionRow);
}

export async function saveCompanyProfileVersion(
  workspaceId: string,
  profile: CompanyProfile,
) {
  if (!profile.structuredProfile)
    throw new Error("Structured Company Profile data is required.");
  const structured = parseStructuredCompanyProfile(profile.structuredProfile);
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase.rpc("save_clean_company_profile_version", {
    target_workspace_id: workspaceId,
    profile_data: structured,
    facts_data: profile.extractedFacts,
    questions_data: profile.reviewQuestions,
    provenance_value: profile.provenance,
  });
  if (error) throw new Error(`Could not save Company Profile: ${error.message}`);
  return mapVersion(data as VersionRow);
}

function mapVersion(row: VersionRow): CompanyProfile {
  if (row.intelligence_version === "v2") return mapV3CompatibilityVersion(row);
  const structured = parseStructuredCompanyProfile(row.structured_profile);
  return {
    id: row.id,
    version: row.version,
    companyName: row.company_name,
    website: row.website_url,
    summary: row.summary,
    productsAndServices: structured.offerings.map((item) => item.name),
    capabilities: structured.capabilities.map((item) => item.name),
    customerTypes: structured.customerLandscape?.customerTypes ?? [],
    differentiators: (structured.differentiators ?? []).map((item) => item.title),
    proofPoints: structured.companyProof.map((item) => item.title),
    marketsAndLanguages: [
      ...structured.operatingMarkets,
      ...structured.supportedLanguages,
    ],
    claims: structured.verifiedClaims ?? [],
    limitations: [
      ...(structured.commercialConstraints ?? []),
      ...(structured.regulatoryLimitations ?? []),
    ],
    sources: structured.research.sources
      .map((item) => item.url)
      .filter((url): url is string => Boolean(url)),
    warnings: structured.unverifiedInformation ?? [],
    lastAnalyzed: row.created_at,
    provenance: row.provenance,
    structuredProfile: structured,
    extractedFacts: row.extracted_facts ?? [],
    reviewQuestions: row.review_questions ?? [],
    profileStatus: row.profile_status,
    readinessScore: row.readiness_score,
  };
}

function mapV3CompatibilityVersion(row: VersionRow): CompanyProfile {
  const snapshot = objectValue(row.structured_profile);
  const offerings = arrayObjects(objectValue(snapshot.offerings).offerings);
  const commercial = objectValue(snapshot.commercialSynthesis);
  return {
    id: row.id,
    version: row.version,
    companyName: row.company_name,
    website: row.website_url,
    summary: row.summary,
    productsAndServices: offerings
      .map((offering) => String(offering.name ?? ""))
      .filter(Boolean),
    capabilities: [],
    customerTypes: [],
    differentiators: [],
    proofPoints: [],
    marketsAndLanguages: [],
    claims: [],
    limitations: stringArray(commercial.unresolvedCommercialQuestions),
    sources: [],
    warnings: [],
    lastAnalyzed: row.created_at,
    provenance: row.provenance,
    structuredProfile: null,
    extractedFacts: row.extracted_facts ?? [],
    reviewQuestions: row.review_questions ?? [],
    profileStatus: row.profile_status,
    readinessScore: row.readiness_score,
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayObjects(value: unknown) {
  return Array.isArray(value) ? value.map(objectValue) : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function emptyProfile(name: string, website: string | null): CompanyProfile {
  return {
    id: null,
    version: 0,
    companyName: name,
    website,
    summary: "",
    productsAndServices: [],
    capabilities: [],
    customerTypes: [],
    differentiators: [],
    proofPoints: [],
    marketsAndLanguages: [],
    claims: [],
    limitations: [],
    sources: [],
    warnings: [],
    lastAnalyzed: null,
    provenance: "workspace",
    structuredProfile: null,
    extractedFacts: [],
    reviewQuestions: [],
    profileStatus: "draft",
    readinessScore: 0,
  };
}

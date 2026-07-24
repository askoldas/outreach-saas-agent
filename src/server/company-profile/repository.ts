import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { CompanyProfile } from "@/types/domain";
import { parseStructuredCompanyProfile } from "@/lib/company-profile/structured-profile";

type CompanyProfileVersionRow = {
  id: string;
  version: number;
  company_name: string;
  website_url: string | null;
  summary: string;
  products_and_services: string[];
  capabilities: string[];
  customer_types: string[];
  differentiators: string[];
  proof_points: string[];
  markets_and_languages: string[];
  claims: string[];
  limitations: string[];
  sources: string[];
  warnings: string[];
  provenance: CompanyProfile["provenance"];
  created_at: string;
  structured_profile: unknown;
  extracted_facts: CompanyProfile["extractedFacts"];
  review_questions: CompanyProfile["reviewQuestions"];
  profile_status: CompanyProfile["profileStatus"];
  readiness_score: number;
};

const versionSelect = `id, version, company_name, website_url, summary, products_and_services, capabilities, customer_types, differentiators, proof_points, markets_and_languages, claims, limitations, sources, warnings, provenance, created_at, structured_profile, extracted_facts, review_questions, profile_status, readiness_score`;

export async function getCurrentCompanyProfile(
  workspaceId: string,
): Promise<CompanyProfile | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("id, current_version")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (profileError) {
    if (isMissingCompanyProfileSchema(profileError)) return null;
    throw new Error(`Could not load Company Profile: ${profileError.message}`);
  }
  if (!profile) return null;
  const { data, error } = await supabase
    .from("company_profile_versions")
    .select(versionSelect)
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profile.id)
    .eq("version", profile.current_version)
    .maybeSingle();
  if (error) throw new Error(`Could not load Company Profile version: ${error.message}`);
  return data ? mapCompanyProfileVersion(data as CompanyProfileVersionRow) : null;
}

export async function saveCompanyProfileVersion(
  workspaceId: string,
  profile: CompanyProfile,
): Promise<CompanyProfile> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  if (!profile.structuredProfile) {
    throw new Error("Structured Company Profile data is required.");
  }
  const structuredProfile = parseStructuredCompanyProfile(profile.structuredProfile);
  const { data, error } = await supabase.rpc("save_structured_company_profile_version", {
    target_workspace_id: workspaceId,
    profile_data: structuredProfile,
    facts_data: profile.extractedFacts,
    questions_data: profile.reviewQuestions,
  });
  if (error) throw new Error(`Could not save Company Profile: ${error.message}`);
  return mapCompanyProfileVersion(data as CompanyProfileVersionRow);
}

function mapCompanyProfileVersion(row: CompanyProfileVersionRow): CompanyProfile {
  return {
    id: row.id,
    version: row.version,
    companyName: row.company_name,
    website: row.website_url,
    summary: row.summary,
    productsAndServices: row.products_and_services,
    capabilities: row.capabilities,
    customerTypes: row.customer_types,
    differentiators: row.differentiators,
    proofPoints: row.proof_points,
    marketsAndLanguages: row.markets_and_languages,
    claims: row.claims,
    limitations: row.limitations,
    sources: row.sources,
    warnings: row.warnings,
    lastAnalyzed: row.created_at,
    provenance: row.provenance,
    structuredProfile: row.structured_profile
      ? parseStructuredCompanyProfile(row.structured_profile)
      : null,
    extractedFacts: row.extracted_facts ?? [],
    reviewQuestions: row.review_questions ?? [],
    profileStatus: row.profile_status ?? "draft",
    readinessScore: row.readiness_score ?? 0,
  };
}

function isMissingCompanyProfileSchema(error: { message?: string }) {
  const message = error.message ?? "";
  return (
    message.includes("company_profiles") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find"))
  );
}

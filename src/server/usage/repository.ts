import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";

export type CommercialValidationMetrics = {
  approvedCompanies: number;
  campaignsWithRepeatRuns: number;
  contactFoundRate: number | null;
  costPerQualifiedCompany: number | null;
  draftApprovalRate: number | null;
  draftCorrectionRate: number | null;
  emailVerificationSuccessRate: number | null;
  exportedRows: number;
  qualificationAcceptanceRate: number | null;
  reviewedCompanies: number;
  totalActualCost: number;
  totalCampaigns: number;
  totalCampaignRuns: number;
};

export async function getCommercialValidationMetrics(
  workspaceId: string,
): Promise<CommercialValidationMetrics> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const [
    campaignsResult,
    runsResult,
    companiesResult,
    qualificationsResult,
    contactsResult,
    verificationsResult,
    draftsResult,
    exportsResult,
    aiRequestsResult,
  ] = await Promise.all([
    supabase.from("campaigns").select("id").eq("workspace_id", workspaceId),
    supabase.from("campaign_runs").select("campaign_id").eq("workspace_id", workspaceId),
    supabase
      .from("campaign_companies")
      .select("id,status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("qualification_results")
      .select("campaign_company_id,status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("campaign_contacts")
      .select("campaign_company_id,selection_status")
      .eq("workspace_id", workspaceId),
    supabase.from("email_verifications").select("status").eq("workspace_id", workspaceId),
    supabase.from("outreach_drafts").select("status").eq("workspace_id", workspaceId),
    supabase.from("export_records").select("row_count").eq("workspace_id", workspaceId),
    supabase
      .from("ai_requests")
      .select("actual_cost,status")
      .eq("workspace_id", workspaceId),
  ]);
  const errors = [
    campaignsResult.error,
    runsResult.error,
    companiesResult.error,
    qualificationsResult.error,
    contactsResult.error,
    verificationsResult.error,
    draftsResult.error,
    exportsResult.error,
    aiRequestsResult.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(`Could not load validation metrics: ${errors[0]?.message}`);
  }

  const companies = companiesResult.data ?? [];
  const reviewedCompanies = companies.filter(
    (item) => !["discovered", "researching"].includes(item.status),
  ).length;
  const approvedCompanyIds = new Set(
    companies
      .filter((item) => ["approved", "draft_ready"].includes(item.status))
      .map((item) => item.id),
  );
  const contactCompanyIds = new Set(
    (contactsResult.data ?? []).map((item) => item.campaign_company_id),
  );
  const qualifiedCompanyIds = new Set(
    (qualificationsResult.data ?? [])
      .filter((item) => ["highly_relevant", "qualified"].includes(item.status))
      .map((item) => item.campaign_company_id),
  );
  const reviewedDrafts = (draftsResult.data ?? []).filter((item) =>
    ["approved", "edited", "rejected"].includes(item.status),
  );
  const runCounts = new Map<string, number>();
  for (const run of runsResult.data ?? []) {
    runCounts.set(run.campaign_id, (runCounts.get(run.campaign_id) ?? 0) + 1);
  }
  const totalActualCost = (aiRequestsResult.data ?? [])
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + Number(item.actual_cost ?? 0), 0);
  const verifications = verificationsResult.data ?? [];

  return {
    approvedCompanies: approvedCompanyIds.size,
    campaignsWithRepeatRuns: [...runCounts.values()].filter((count) => count > 1).length,
    contactFoundRate: rate(
      [...approvedCompanyIds].filter((id) => contactCompanyIds.has(id)).length,
      approvedCompanyIds.size,
    ),
    costPerQualifiedCompany:
      qualifiedCompanyIds.size > 0 ? totalActualCost / qualifiedCompanyIds.size : null,
    draftApprovalRate: rate(
      reviewedDrafts.filter((item) => item.status === "approved").length,
      reviewedDrafts.length,
    ),
    draftCorrectionRate: rate(
      reviewedDrafts.filter((item) => item.status === "edited").length,
      reviewedDrafts.length,
    ),
    emailVerificationSuccessRate: rate(
      verifications.filter((item) => item.status === "valid").length,
      verifications.length,
    ),
    exportedRows: (exportsResult.data ?? []).reduce(
      (sum, item) => sum + item.row_count,
      0,
    ),
    qualificationAcceptanceRate: rate(approvedCompanyIds.size, reviewedCompanies),
    reviewedCompanies,
    totalActualCost,
    totalCampaigns: campaignsResult.data?.length ?? 0,
    totalCampaignRuns: runsResult.data?.length ?? 0,
  };
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

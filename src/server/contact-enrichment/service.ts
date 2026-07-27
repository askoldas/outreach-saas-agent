import {
  discoverContactRoutes,
  extractContactRoutesFromEvidence,
} from "@/lib/discovery/contact-extractor";
import {
  enrichCompanyContacts,
  type EnrichedContactRoute,
} from "@/lib/providers/contact-enrichment";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  loadProviderResult,
  storeProviderResult,
} from "@/server/execution/provider-result-cache";
import type { ContactRoute } from "@/types/domain";

export async function executeContactEnrichment(providerExecutionId: string) {
  const supabase = createServiceRoleClient();
  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .select("id,workspace_id,campaign_run_id,idempotency_key,metadata,status")
    .eq("id", providerExecutionId)
    .eq("operation", "contact_enrichment")
    .single();
  if (executionError)
    throw new Error(`Could not load contact execution: ${executionError.message}`);

  const campaignCompanyId = stringValue(execution.metadata, "campaignCompanyId");
  const enrichmentId = stringValue(execution.metadata, "contactEnrichmentId");
  if (!campaignCompanyId || !enrichmentId)
    throw new Error("Contact execution is missing its clean entity references.");
  if (execution.status === "completed")
    return {
      campaignCompanyId,
      routeCount: numberValue(execution.metadata, "routeCount"),
    };

  const { data: association, error: associationError } = await supabase
    .from("campaign_companies")
    .select(
      "id,workspace_id,company_id,source_summary,company:companies!inner(name,website_url,description,company_sources(source_url,title,excerpt))",
    )
    .eq("workspace_id", execution.workspace_id)
    .eq("id", campaignCompanyId)
    .single();
  if (associationError)
    throw new Error(
      `Could not load contact enrichment context: ${associationError.message}`,
    );

  const company = association.company as unknown as {
    name: string;
    website_url: string | null;
    description: string;
    company_sources: Array<{
      source_url: string;
      title: string;
      excerpt: string;
    }> | null;
  };
  if (!company.website_url)
    throw new Error("A company website is required for contact enrichment.");

  const startedAt = new Date().toISOString();
  await updateExecution(providerExecutionId, {
    status: "running",
    started_at: startedAt,
    error_code: null,
    error_message: null,
  });
  await updateEnrichment(enrichmentId, {
    status: "running",
    started_at: startedAt,
    error_code: null,
    error_message: null,
  });

  try {
    const sourceText = [
      company.description,
      association.source_summary,
      ...(company.company_sources ?? []).flatMap((source) => [
        source.title,
        source.source_url,
        source.excerpt,
      ]),
    ]
      .filter(Boolean)
      .join("\n");
    const evidenceRoutes = extractContactRoutesFromEvidence({
      sourceUrl: company.website_url,
      text: sourceText,
      website: company.website_url,
    });
    const inputHash = hash({
      company: company.name,
      sourceText,
      website: company.website_url,
    });
    let providerResult = await loadProviderResult<{
      providerRoutes: EnrichedContactRoute[];
      websiteRoutes: ContactRoute[];
    }>(providerExecutionId, inputHash);
    if (!providerResult) {
      const [providerRoutes, websiteResult] = await Promise.all([
        enrichCompanyContacts({
          company: company.name,
          website: company.website_url,
        }),
        discoverContactRoutes({
          content: sourceText,
          score: null,
          title: company.name,
          url: company.website_url,
        }).catch(() => ({ routes: [] })),
      ]);
      providerResult = {
        providerRoutes,
        websiteRoutes: websiteResult.routes,
      };
      await storeProviderResult(providerExecutionId, inputHash, providerResult);
    }
    const routes = dedupeRoutes([
      ...evidenceRoutes,
      ...providerResult.websiteRoutes,
      ...providerResult.providerRoutes,
    ]);
    for (const route of routes)
      await persistRoute({
        workspaceId: execution.workspace_id,
        campaignCompanyId,
        companyId: association.company_id,
        route,
      });

    const completedAt = new Date().toISOString();
    const status = routes.length > 0 ? "completed" : "not_found";
    await updateEnrichment(enrichmentId, {
      status,
      completed_at: completedAt,
      result_summary: {
        routeCount: routes.length,
        sourceConfirmedCount: routes.filter(
          (route) => route.verification === "source_confirmed",
        ).length,
      },
    });
    await updateExecution(providerExecutionId, {
      status: "completed",
      completed_at: completedAt,
      metadata: {
        ...asRecord(execution.metadata),
        routeCount: routes.length,
      },
    });
    if (execution.campaign_run_id)
      await syncCampaignRun(execution.workspace_id, execution.campaign_run_id);
    const { error: usageError } = await supabase.from("usage_ledger").upsert(
      {
        workspace_id: execution.workspace_id,
        campaign_run_id: execution.campaign_run_id,
        provider_execution_id: execution.id,
        operation: "contact_enrichment",
        entry_type: "settlement",
        idempotency_key: execution.idempotency_key,
        credits: 0,
        metadata: { campaignCompanyId, routeCount: routes.length },
      },
      { onConflict: "workspace_id,entry_type,idempotency_key" },
    );
    if (usageError)
      throw new Error(`Could not record contact usage: ${usageError.message}`);
    return { campaignCompanyId, routeCount: routes.length };
  } catch (error) {
    throw error;
  }
}

async function syncCampaignRun(workspaceId: string, campaignRunId: string) {
  const supabase = createServiceRoleClient();
  const [
    { count: contactsFound, error: contactsError },
    { count: activeExecutions, error: activeError },
  ] = await Promise.all([
    supabase
      .from("campaign_contacts")
      .select("id,campaign_company:campaign_companies!inner(campaign_run_id)", {
        count: "exact",
        head: true,
      })
      .eq("workspace_id", workspaceId)
      .eq("campaign_company.campaign_run_id", campaignRunId),
    supabase
      .from("provider_executions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", campaignRunId)
      .eq("operation", "contact_enrichment")
      .in("status", ["pending", "running"]),
  ]);
  if (contactsError)
    throw new Error(`Could not count Campaign contacts: ${contactsError.message}`);
  if (activeError)
    throw new Error(`Could not count active enrichments: ${activeError.message}`);
  const finished = (activeExecutions ?? 0) === 0;
  const { error } = await supabase
    .from("campaign_runs")
    .update({
      status: finished ? "completed" : "enriching",
      current_phase: finished ? "waiting_for_outreach_approval" : "enriching",
      progress_percentage: finished ? 100 : 95,
      contacts_found: contactsFound ?? 0,
      ...(finished ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignRunId);
  if (error)
    throw new Error(`Could not synchronize Campaign enrichment: ${error.message}`);
}

async function persistRoute(input: {
  workspaceId: string;
  campaignCompanyId: string;
  companyId: string;
  route: ContactRoute | EnrichedContactRoute;
}) {
  const supabase = createServiceRoleClient();
  const methodType = cleanMethodType(input.route.type);
  const normalizedValue = normalizeValue(methodType, input.route.value);
  const { data: existing, error: lookupError } = await supabase
    .from("contact_methods")
    .select("id,company_id")
    .eq("workspace_id", input.workspaceId)
    .eq("method_type", methodType)
    .eq("normalized_value", normalizedValue)
    .maybeSingle();
  if (lookupError)
    throw new Error(`Could not resolve contact method: ${lookupError.message}`);
  if (existing && existing.company_id !== input.companyId)
    throw new Error("Contact method belongs to another company.");

  let contactMethodId = existing?.id;
  if (!contactMethodId) {
    const { data, error } = await supabase
      .from("contact_methods")
      .insert({
        workspace_id: input.workspaceId,
        company_id: input.companyId,
        method_type: methodType,
        value: input.route.value.trim(),
        normalized_value: normalizedValue,
        verification_status:
          input.route.verification === "source_confirmed"
            ? "source_confirmed"
            : input.route.verification === "unknown"
              ? "unknown"
              : "unverified",
        metadata: { source: input.route.source },
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not save contact method: ${error.message}`);
    contactMethodId = data.id;
  }

  if ("provenance" in input.route) {
    const provenance = input.route.provenance;
    const { data: source } = await supabase
      .from("contact_sources")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("contact_method_id", contactMethodId)
      .eq("provider", provenance.provider)
      .eq("source_url", provenance.sourceUrl)
      .maybeSingle();
    if (!source) {
      const { error } = await supabase.from("contact_sources").insert({
        workspace_id: input.workspaceId,
        contact_method_id: contactMethodId,
        provider: provenance.provider,
        query: provenance.query,
        source_title: provenance.sourceTitle,
        source_url: provenance.sourceUrl,
        retrieved_at: provenance.verifiedAt,
      });
      if (error) throw new Error(`Could not save contact source: ${error.message}`);
    }
  }

  const { data: campaignContact, error: campaignContactError } = await supabase
    .from("campaign_contacts")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_company_id", input.campaignCompanyId)
    .eq("contact_method_id", contactMethodId)
    .maybeSingle();
  if (campaignContactError)
    throw new Error(
      `Could not resolve Campaign contact: ${campaignContactError.message}`,
    );
  if (!campaignContact) {
    const { error } = await supabase.from("campaign_contacts").insert({
      workspace_id: input.workspaceId,
      campaign_company_id: input.campaignCompanyId,
      contact_method_id: contactMethodId,
      role_relevance: input.route.suggestedRole,
      selection_status: "candidate",
      recommendation_reason: input.route.source,
    });
    if (error) throw new Error(`Could not save Campaign contact: ${error.message}`);
  }
}

async function updateExecution(id: string, values: Record<string, unknown>) {
  const { error } = await createServiceRoleClient()
    .from("provider_executions")
    .update(values)
    .eq("id", id);
  if (error) throw new Error(`Could not update contact execution: ${error.message}`);
}

async function updateEnrichment(id: string, values: Record<string, unknown>) {
  const { error } = await createServiceRoleClient()
    .from("contact_enrichments")
    .update(values)
    .eq("id", id);
  if (error) throw new Error(`Could not update contact enrichment: ${error.message}`);
}

function cleanMethodType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("phone")) return "phone" as const;
  if (normalized.includes("linkedin")) return "linkedin_url" as const;
  if (normalized.includes("form") || normalized.includes("page"))
    return "contact_form" as const;
  if (normalized.includes("website")) return "website" as const;
  return "email" as const;
}

function normalizeValue(methodType: string, value: string) {
  const trimmed = value.trim();
  if (methodType === "email") return trimmed.toLowerCase();
  if (methodType === "phone") return trimmed.replace(/[^\d+]/g, "");
  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString().replace(/\/$/g, "").toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function dedupeRoutes(routes: Array<ContactRoute | EnrichedContactRoute>) {
  const byKey = new Map<string, ContactRoute | EnrichedContactRoute>();
  for (const route of routes) {
    const key = `${cleanMethodType(route.type)}:${normalizeValue(
      cleanMethodType(route.type),
      route.value,
    )}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      ("provenance" in route && !("provenance" in existing)) ||
      (route.verification === "source_confirmed" &&
        existing.verification !== "source_confirmed")
    )
      byKey.set(key, route);
  }
  return [...byKey.values()];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, key: string) {
  const record = asRecord(value);
  return typeof record[key] === "string" ? record[key] : "";
}

function numberValue(value: unknown, key: string) {
  const field = asRecord(value)[key];
  return typeof field === "number" ? field : 0;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
import { createHash } from "node:crypto";

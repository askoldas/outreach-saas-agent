import type { SupabaseClient } from "@supabase/supabase-js";
import type { Confidence, ContactRoute } from "../../types/domain.ts";
import {
  discoverContactRoutes,
  extractContactRoutesFromEvidence,
} from "../../lib/discovery/contact-extractor.ts";
import { updateRunStep } from "../lib/task-status.ts";
import type { ResearchTaskRow } from "../lib/claim-task.ts";

type EnrichContactsPayload = {
  leadDatabaseId: string;
  leadExternalId: string;
  source: {
    content?: string;
    query?: string;
    title?: string;
    url: string;
  };
  website?: string;
};

type LeadContactContext = {
  campaign_id: string | null;
  company: string;
  description: string;
  external_id: string;
  industry: string;
  qualification_error: string | null;
  summary: string;
  website: string;
  lead_evidence_claims: Array<{
    external_id: string;
    source_label: string;
    source_type: string;
    source_url: string;
    text: string;
  }> | null;
  lead_qualification_dimensions: Array<{
    explanation: string;
    label: string;
  }> | null;
};

type LeadSourceRow = {
  content: string;
  query: string;
  result_json: Record<string, unknown> | null;
  source_type: string;
  title: string;
  url: string;
};

export async function processEnrichContactsTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Discovering contacts", 75);
  const payload = parsePayload(task);
  const context = await loadLeadContactContext(supabase, payload.leadDatabaseId);
  const leadSources = await loadLeadSources(supabase, task, payload, context);
  const sourceText = buildSearchableContactText(payload, context, leadSources);
  const evidenceRoutes = extractContactRoutesFromEvidence({
    sourceUrl: payload.source.url,
    text: sourceText,
    website: context.website || payload.website,
  });
  const websiteRoutes = await tryDiscoverWebsiteContactRoutes(payload);
  const routes = dedupeRoutes([...evidenceRoutes, ...websiteRoutes]);

  await saveLeadContactRoutes(supabase, payload.leadDatabaseId, routes, sourceText);

  return {
    confirmedRouteCount: routes.filter((route) => route.verification === "source_confirmed")
      .length,
    leadId: payload.leadExternalId,
    routeCount: routes.length,
  };
}

async function loadLeadContactContext(
  supabase: SupabaseClient,
  leadDatabaseId: string,
) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
        external_id,
        campaign_id,
        company,
        website,
        industry,
        description,
        summary,
        qualification_error,
        lead_evidence_claims (
          external_id,
          text,
          source_type,
          source_label,
          source_url
        ),
        lead_qualification_dimensions (
          label,
          explanation
        )
      `,
    )
    .eq("id", leadDatabaseId)
    .single();

  if (error) {
    throw new Error(`Could not load lead for contact enrichment: ${error.message}`);
  }

  return data as LeadContactContext;
}

async function loadLeadSources(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  payload: EnrichContactsPayload,
  context: LeadContactContext,
) {
  const urls = new Set<string>();

  if (payload.source.url) {
    urls.add(payload.source.url);
  }

  if (context.website) {
    urls.add(context.website);
  }

  for (const claim of context.lead_evidence_claims ?? []) {
    if (claim.source_url) {
      urls.add(claim.source_url);
    }
  }

  if (urls.size === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("lead_sources")
    .select("title,url,content,query,source_type,result_json")
    .eq("workspace_id", task.workspace_id)
    .eq("campaign_id", task.campaign_id)
    .in("url", [...urls]);

  if (error) {
    throw new Error(`Could not load lead sources for contact enrichment: ${error.message}`);
  }

  return (data ?? []) as LeadSourceRow[];
}

async function tryDiscoverWebsiteContactRoutes(payload: EnrichContactsPayload) {
  try {
    const result = await discoverContactRoutes({
      content: payload.source.content ?? "",
      score: null,
      title: payload.source.title ?? payload.leadExternalId,
      url: payload.website || payload.source.url,
    });

    return result.routes;
  } catch {
    return [];
  }
}

async function saveLeadContactRoutes(
  supabase: SupabaseClient,
  leadDatabaseId: string,
  routes: ContactRoute[],
  sourceText: string,
) {
  const { error: deleteError } = await supabase
    .from("lead_contact_routes")
    .delete()
    .eq("lead_id", leadDatabaseId);

  if (deleteError) {
    throw new Error(`Could not clear lead contact routes: ${deleteError.message}`);
  }

  if (routes.length > 0) {
    const { error: insertError } = await supabase.from("lead_contact_routes").insert(
      routes.map((route, index) => ({
        lead_id: leadDatabaseId,
        sort_order: index,
        source: route.source,
        suggested_role: route.suggestedRole,
        type: route.type,
        value: route.value,
        verification: route.verification,
      })),
    );

    if (insertError) {
      throw new Error(`Could not save lead contact routes: ${insertError.message}`);
    }
  }

  const confirmedRouteCount = routes.filter(
    (route) => route.verification === "source_confirmed",
  ).length;
  const contactability: Confidence =
    confirmedRouteCount >= 2 ? "high" : confirmedRouteCount === 1 ? "medium" : "low";
  const { error: updateError } = await supabase
    .from("leads")
    .update({ contactability })
    .eq("id", leadDatabaseId);

  if (updateError) {
    throw new Error(`Could not update lead contactability: ${updateError.message}`);
  }

  const { error: statusError } = await supabase
    .from("leads")
    .update({ status: "needs_review" })
    .eq("id", leadDatabaseId)
    .eq("status", "researching");

  if (statusError) {
    throw new Error(`Could not return researched lead to review: ${statusError.message}`);
  }

  const { error: evidenceError } = await supabase.from("lead_evidence_claims").upsert(
    {
      confidence: confirmedRouteCount > 0 ? "medium" : "low",
      external_id: "contact-enrichment",
      kind: confirmedRouteCount > 0 ? "fact" : "unknown",
      lead_id: leadDatabaseId,
      retrieved_at: new Date().toISOString().slice(0, 10),
      sort_order: 3,
      source_label: "Contact enrichment worker",
      source_type: "Deterministic contact extraction",
      source_url: "",
      text:
        confirmedRouteCount > 0
          ? `Contact discovery completed and found ${confirmedRouteCount} source-confirmed public route${confirmedRouteCount === 1 ? "" : "s"}.`
          : `Contact discovery completed but found no public email or phone in ${sourceText.length} characters of saved lead evidence.`,
    },
    { onConflict: "lead_id,external_id" },
  );

  if (evidenceError) {
    throw new Error(`Could not save contact enrichment marker: ${evidenceError.message}`);
  }
}

function parsePayload(task: ResearchTaskRow): EnrichContactsPayload {
  const payload = task.payload_json;
  const source = payload.source;

  if (
    typeof payload.leadDatabaseId !== "string" ||
    typeof payload.leadExternalId !== "string" ||
    !source ||
    typeof source !== "object" ||
    !("url" in source) ||
    typeof source.url !== "string"
  ) {
    throw new Error("enrich_contacts task missing lead or source payload.");
  }

  return {
    leadDatabaseId: payload.leadDatabaseId,
    leadExternalId: payload.leadExternalId,
    source: source as EnrichContactsPayload["source"],
    website: typeof payload.website === "string" ? payload.website : undefined,
  };
}

function dedupeRoutes(routes: ContactRoute[]) {
  const byKey = new Map<string, ContactRoute>();

  for (const route of routes) {
    const key = `${route.type.toLowerCase()}:${normalizeValue(route.value)}`;
    const existing = byKey.get(key);

    if (!existing || route.verification === "source_confirmed") {
      byKey.set(key, route);
    }
  }

  return [...byKey.values()].sort((first, second) => {
    const order = ["Email", "Phone", "Contact page", "Website"];
    return order.indexOf(first.type) - order.indexOf(second.type);
  });
}

function buildSearchableContactText(
  payload: EnrichContactsPayload,
  context: LeadContactContext,
  leadSources: LeadSourceRow[],
) {
  return [
    context.company,
    context.website,
    context.industry,
    context.description,
    context.summary,
    context.qualification_error,
    payload.source.title,
    payload.source.url,
    payload.source.query,
    payload.source.content,
    ...(context.lead_qualification_dimensions ?? []).flatMap((dimension) => [
      dimension.label,
      dimension.explanation,
    ]),
    ...(context.lead_evidence_claims ?? []).flatMap((claim) => [
      claim.source_label,
      claim.source_type,
      claim.source_url,
      claim.text,
    ]),
    ...leadSources.flatMap((source) => [
      source.title,
      source.url,
      source.query,
      source.content,
      JSON.stringify(source.result_json ?? {}),
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeValue(value: string) {
  if (value.includes("@")) {
    return value.toLowerCase();
  }

  if (/^\+?[\d\s()./-]+$/.test(value)) {
    return value.replace(/\D/g, "");
  }

  return value.trim().replace(/\/$/g, "").toLowerCase();
}

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

export async function processEnrichContactsTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Discovering contacts", 75);
  const payload = parsePayload(task);
  const sourceText = [
    payload.source.title,
    payload.source.url,
    payload.source.query,
    payload.source.content,
  ]
    .filter(Boolean)
    .join("\n");
  const evidenceRoutes = extractContactRoutesFromEvidence({
    sourceUrl: payload.source.url,
    text: sourceText,
    website: payload.website,
  });
  const websiteRoutes = await tryDiscoverWebsiteContactRoutes(payload);
  const routes = dedupeRoutes([...evidenceRoutes, ...websiteRoutes]);

  await saveLeadContactRoutes(supabase, payload.leadDatabaseId, routes);

  return {
    confirmedRouteCount: routes.filter((route) => route.verification === "source_confirmed")
      .length,
    leadId: payload.leadExternalId,
    routeCount: routes.length,
  };
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

function normalizeValue(value: string) {
  if (value.includes("@")) {
    return value.toLowerCase();
  }

  if (/^\+?[\d\s()./-]+$/.test(value)) {
    return value.replace(/\D/g, "");
  }

  return value.trim().replace(/\/$/g, "").toLowerCase();
}

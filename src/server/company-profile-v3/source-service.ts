import { createHash } from "node:crypto";
import { readNativeCompanyProfileSourceSet } from "@/lib/intelligence/company-profile-v3/native-source";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { extractWebPages, searchWeb, type SearchResult } from "@/lib/providers/tavily";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database.types";

const maximumPages = 5;
const maximumPageLength = 8_000;

type EvidenceInsert = Database["public"]["Tables"]["evidence_items"]["Insert"];

export async function ensureNativeCompanyProfileEvidence(input: {
  draftSnapshot: Json;
  inputHash: string;
  profileDraftId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const existing = await loadEvidence(input.workspaceId, input.profileDraftId);
  if (existing.length) return existing;

  const sourceSet = readNativeCompanyProfileSourceSet(input.draftSnapshot);
  const operation = "company_profile_source_collection";
  const idempotencyKey = [
    "profile-v3-source",
    input.profileDraftId,
    input.inputHash,
  ].join(":");
  const { data: priorExecution, error: priorError } = await supabase
    .from("provider_executions")
    .select("id,attempt")
    .eq("workspace_id", input.workspaceId)
    .eq("operation", operation)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (priorError) {
    throw new Error(
      `Could not inspect Company Intelligence source collection: ${priorError.message}`,
    );
  }

  const startedAt = new Date().toISOString();
  const executionValues = {
    workspace_id: input.workspaceId,
    provider: "tavily",
    operation,
    idempotency_key: idempotencyKey,
    request_hash: input.inputHash,
    status: "running",
    attempt: (priorExecution?.attempt ?? 0) + 1,
    dispatch_state: "running",
    dispatch_updated_at: startedAt,
    started_at: startedAt,
    completed_at: null,
    error_code: null,
    error_message: null,
    metadata: {
      contractVersion: sourceSet.contractVersion,
      profileDraftId: input.profileDraftId,
      primaryWebsiteUrl: sourceSet.primaryWebsiteUrl,
    },
  } satisfies Database["public"]["Tables"]["provider_executions"]["Insert"];
  const executionQuery = priorExecution
    ? supabase
        .from("provider_executions")
        .update(executionValues)
        .eq("workspace_id", input.workspaceId)
        .eq("id", priorExecution.id)
    : supabase.from("provider_executions").insert(executionValues);
  const { data: execution, error: executionError } = await executionQuery
    .select("id")
    .single();
  if (executionError) {
    throw new Error(
      `Could not start Company Intelligence source collection: ${executionError.message}`,
    );
  }

  try {
    assertIntelligenceExternalCallsAllowed("provider");
    const pages = await collectOfficialPages(sourceSet);
    if (!pages.length) {
      throw new Error("The official company website returned no usable public content.");
    }
    const retrievedAt = new Date().toISOString();
    const evidenceRows: EvidenceInsert[] = pages.map((page) => ({
      workspace_id: input.workspaceId,
      subject_type: "company_profile_draft",
      subject_id: input.profileDraftId,
      provider_execution_id: execution.id,
      evidence_type: "official_web_page",
      structured_value_json: {
        content: page.content,
        title: page.title,
        url: page.url,
      },
      excerpt: compact(page.content).slice(0, 800),
      location_json: { title: page.title, url: page.url },
      directness: "direct",
      source_reliability: "first_party",
      freshness_state: "current",
      observed_at: retrievedAt,
      retrieved_at: retrievedAt,
      content_hash: digest(`${page.url}\n${page.content}`),
      visibility: "workspace_private",
    }));
    const { error: evidenceError } = await supabase
      .from("evidence_items")
      .upsert(evidenceRows, {
        ignoreDuplicates: true,
        onConflict: "workspace_id,subject_type,subject_id,content_hash",
      });
    if (evidenceError) {
      throw new Error(
        `Could not persist Company Intelligence evidence: ${evidenceError.message}`,
      );
    }
    const evidence = await loadEvidence(input.workspaceId, input.profileDraftId);
    if (!evidence.length) {
      throw new Error("Company Intelligence evidence was not persisted.");
    }
    const completedAt = new Date().toISOString();
    const { error: completionError } = await supabase
      .from("provider_executions")
      .update({
        status: "completed",
        dispatch_state: "completed",
        dispatch_updated_at: completedAt,
        completed_at: completedAt,
        metadata: {
          contractVersion: sourceSet.contractVersion,
          evidenceCount: evidence.length,
          profileDraftId: input.profileDraftId,
          primaryWebsiteUrl: sourceSet.primaryWebsiteUrl,
        },
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", execution.id);
    if (completionError) {
      throw new Error(
        `Could not settle Company Intelligence source collection: ${completionError.message}`,
      );
    }
    return evidence;
  } catch (error) {
    const completedAt = new Date().toISOString();
    await supabase
      .from("provider_executions")
      .update({
        status: "failed",
        dispatch_state: "failed",
        dispatch_updated_at: completedAt,
        completed_at: completedAt,
        error_code: errorCode(error),
        error_message: errorMessage(error).slice(0, 2_000),
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", execution.id);
    throw error;
  }
}

async function collectOfficialPages(
  sourceSet: ReturnType<typeof readNativeCompanyProfileSourceSet>,
) {
  const primary = new URL(sourceSet.primaryWebsiteUrl);
  let searchResults: SearchResult[] = [];
  let searchFailure: unknown;
  try {
    searchResults = await searchWeb(
      `${primary.hostname} company products services capabilities customers markets about`,
      maximumPages,
      {
        includeDomains: sourceSet.allowedDomains,
        includeRawContent: true,
      },
    );
  } catch (error) {
    searchFailure = error;
  }

  const urls = [sourceSet.primaryWebsiteUrl, ...searchResults.map((result) => result.url)]
    .filter((url, index, entries) => entries.indexOf(url) === index)
    .filter((url) => isAllowedOfficialUrl(url, sourceSet.allowedDomains))
    .slice(0, maximumPages);
  let extracted: SearchResult[] = [];
  let extractionFailure: unknown;
  try {
    extracted = await extractWebPages(urls);
  } catch (error) {
    extractionFailure = error;
  }

  const byUrl = new Map<string, SearchResult>();
  for (const result of [...searchResults, ...extracted]) {
    if (
      !result.content.trim() ||
      !isAllowedOfficialUrl(result.url, sourceSet.allowedDomains)
    ) {
      continue;
    }
    const existing = byUrl.get(result.url);
    if (!existing || result.content.length > existing.content.length) {
      byUrl.set(result.url, {
        ...result,
        content: result.content.trim().slice(0, maximumPageLength),
      });
    }
  }
  const pages = [...byUrl.values()]
    .sort((left, right) => {
      const leftPrimary = left.url === sourceSet.primaryWebsiteUrl ? 0 : 1;
      const rightPrimary = right.url === sourceSet.primaryWebsiteUrl ? 0 : 1;
      return leftPrimary - rightPrimary || right.content.length - left.content.length;
    })
    .slice(0, maximumPages);
  if (!pages.length && (extractionFailure || searchFailure)) {
    throw new Error(
      `The official website could not be collected: ${errorMessage(
        extractionFailure ?? searchFailure,
      )}`,
    );
  }
  return pages;
}

async function loadEvidence(workspaceId: string, profileDraftId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("evidence_items")
    .select(
      "id,evidence_type,excerpt,structured_value_json,directness,source_reliability,freshness_state,retrieved_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("subject_type", "company_profile_draft")
    .eq("subject_id", profileDraftId)
    .order("retrieved_at", { ascending: false })
    .limit(40);
  if (error) {
    throw new Error(`Could not load Company Intelligence evidence: ${error.message}`);
  }
  return data ?? [];
}

function isAllowedOfficialUrl(value: string, allowedDomains: string[]) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      ["http:", "https:"].includes(url.protocol) &&
      allowedDomains.some((domain) => {
        const allowed = domain.toLowerCase().replace(/^www\./, "");
        const candidate = hostname.replace(/^www\./, "");
        return (
          candidate === allowed ||
          candidate.endsWith(`.${allowed}`) ||
          allowed.endsWith(`.${candidate}`)
        );
      })
    );
  } catch {
    return false;
  }
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "profile_source_collection_failed";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

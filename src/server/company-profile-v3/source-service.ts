import { createHash } from "node:crypto";
import { nativeCompanyProfileForceRefresh, nativeCompanyProfileId, readNativeCompanyProfileSourceSet } from "@/lib/intelligence/company-profile-v3/native-source";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { extractWebPages, searchWeb, type SearchResult } from "@/lib/providers/tavily";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database.types";

const maximumPages = 5;
const maximumPageLength = 8_000;
const extractorVersion = "company-profile-pages/v2-commercial-selective";
const cacheFreshMs = 24 * 60 * 60 * 1_000;

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
  const companyProfileId = nativeCompanyProfileId(input.draftSnapshot);
  const forceRefresh = nativeCompanyProfileForceRefresh(input.draftSnapshot);
  const cachedPages = forceRefresh ? [] : await loadCachedPages(input.workspaceId, companyProfileId, new URL(sourceSet.primaryWebsiteUrl).hostname.replace(/^www\./, ""));
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

  if (cachedPages.length) {
    await persistEvidenceRows(input, cachedPages, execution.id);
    const completedAt = new Date().toISOString();
    await supabase.from("provider_executions").update({
      status:"completed", dispatch_state:"completed", dispatch_updated_at:completedAt, completed_at:completedAt,
      metadata:{ contractVersion:sourceSet.contractVersion, profileDraftId:input.profileDraftId, primaryWebsiteUrl:sourceSet.primaryWebsiteUrl, cacheHits:cachedPages.length, cacheMisses:0, extractorVersion },
    }).eq("workspace_id",input.workspaceId).eq("id",execution.id);
    return loadEvidence(input.workspaceId, input.profileDraftId);
  }

  try {
    assertIntelligenceExternalCallsAllowed("provider");
    const pages = await collectOfficialPages(sourceSet);
    if (!pages.length) {
      throw new Error("The official company website returned no usable public content.");
    }
    await persistEvidenceRows(input, pages, execution.id);
    await persistPageCache(input.workspaceId, companyProfileId, sourceSet.primaryWebsiteUrl, pages);
    const evidence = await loadEvidence(input.workspaceId, input.profileDraftId);
    if (!evidence.length) {
      throw new Error("Company Intelligence evidence was not persisted.");
    }
    const completedAt = new Date().toISOString();
    const { error: completionError } = await supabase
      .from("provider_executions")
      .update({
        status: "completed", dispatch_state: "completed", dispatch_updated_at: completedAt, completed_at: completedAt,
        metadata: { contractVersion: sourceSet.contractVersion, evidenceCount: evidence.length, profileDraftId: input.profileDraftId, primaryWebsiteUrl: sourceSet.primaryWebsiteUrl, cacheHits: 0, cacheMisses: pages.length, extractorVersion },
      }).eq("workspace_id", input.workspaceId).eq("id", execution.id);
    if (completionError) throw new Error(`Could not settle Company Intelligence source collection: ${completionError.message}`);
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
    .filter((url) => isCommerciallyUsefulUrl(url, sourceSet.primaryWebsiteUrl))
    .sort((left, right) => commercialUrlScore(right, sourceSet.primaryWebsiteUrl) - commercialUrlScore(left, sourceSet.primaryWebsiteUrl))
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

function isCommerciallyUsefulUrl(value: string, primaryWebsiteUrl: string) {
  if (value === primaryWebsiteUrl) return true;
  const path = new URL(value).pathname.toLowerCase();
  return !/(?:privacy|terms|cookies?|login|account|cart|checkout|page\/\d+|news\/page|\?.*page=)/.test(path);
}

function commercialUrlScore(value: string, primaryWebsiteUrl: string) {
  if (value === primaryWebsiteUrl) return 100;
  const path = new URL(value).pathname.toLowerCase();
  if (/customer|case-stud|client|reference/.test(path)) return 90;
  if (/product|service|solution|industr|categor/.test(path)) return 80;
  if (/about|company|capabilit/.test(path)) return 70;
  return 10;
}

async function loadCachedPages(workspaceId: string, companyProfileId: string, canonicalDomain: string): Promise<SearchResult[]> {
  const database = createServiceRoleClient() as unknown as { from(table: string): { select(columns: string): CacheSelectBuilder } };
  const cutoff = new Date(Date.now() - cacheFreshMs).toISOString();
  const { data, error } = await database.from("company_profile_page_cache_v2")
    .select("url,title,content,content_hash,fetched_at")
    .eq("workspace_id", workspaceId).eq("company_profile_id", companyProfileId).eq("canonical_domain", canonicalDomain)
    .eq("extractor_version", extractorVersion).gte("fetched_at", cutoff)
    .order("fetched_at", { ascending: false }).limit(20);
  if (error) throw new Error(`Could not inspect Company Intelligence page cache: ${error.message}`);
  const seen = new Set<string>();
  return (data ?? []).filter((row) => !seen.has(row.url) && Boolean(seen.add(row.url))).slice(0, maximumPages)
    .map((row) => ({ url: row.url, title: row.title, content: row.content, score: null }));
}

type CacheSelectBuilder = PromiseLike<{ data: Array<{url:string;title:string;content:string;content_hash:string;fetched_at:string}> | null; error: {message:string}|null }> & {
  eq(column:string,value:string): CacheSelectBuilder; gte(column:string,value:string): CacheSelectBuilder;
  order(column:string,options:{ascending:boolean}): CacheSelectBuilder; limit(value:number): CacheSelectBuilder;
};

async function persistPageCache(workspaceId: string, companyProfileId: string, primaryWebsiteUrl: string, pages: SearchResult[]) {
  const database = createServiceRoleClient() as unknown as { from(table:string): { upsert(values:Record<string,unknown>[],options:Record<string,unknown>): PromiseLike<{error:{message:string}|null}> } };
  const canonicalDomain = new URL(primaryWebsiteUrl).hostname.toLowerCase().replace(/^www\./, "");
  const { error } = await database.from("company_profile_page_cache_v2").upsert(pages.map((page) => ({
    workspace_id: workspaceId, company_profile_id: companyProfileId, canonical_domain: canonicalDomain, url: page.url, title: page.title,
    content: page.content, content_hash: digest(`${page.url}\n${page.content}`), extractor_version: extractorVersion, fetched_at: new Date().toISOString(),
  })), { onConflict: "workspace_id,url,content_hash,extractor_version", ignoreDuplicates: true });
  if (error) throw new Error(`Could not persist Company Intelligence page cache: ${error.message}`);
}

async function persistEvidenceRows(input: {workspaceId:string;profileDraftId:string}, pages: SearchResult[], providerExecutionId: string | null) {
  const retrievedAt = new Date().toISOString();
  const evidenceRows: EvidenceInsert[] = pages.map((page) => ({
    workspace_id: input.workspaceId, subject_type: "company_profile_draft", subject_id: input.profileDraftId,
    provider_execution_id: providerExecutionId, evidence_type: "official_web_page",
    structured_value_json: { content: page.content, title: page.title, url: page.url },
    excerpt: compact(page.content).slice(0,800), location_json:{title:page.title,url:page.url}, directness:"direct",
    source_reliability:"first_party", freshness_state:"current", observed_at:retrievedAt, retrieved_at:retrievedAt,
    content_hash:digest(`${page.url}\n${page.content}`), visibility:"workspace_private",
  }));
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("evidence_items").upsert(evidenceRows,{ignoreDuplicates:true,onConflict:"workspace_id,subject_type,subject_id,content_hash"});
  if (error) throw new Error(`Could not persist Company Intelligence evidence: ${error.message}`);
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

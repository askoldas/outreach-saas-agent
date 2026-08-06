import type { EvidenceReference } from "@/lib/intelligence/contracts";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { DynamicDatabaseClient } from "./database";

type EvidenceSource =
  | { kind: "company_source"; companySourceId: string }
  | { kind: "document_chunk"; documentChunkId: string }
  | { kind: "provider_execution"; providerExecutionId: string }
  | { kind: "manual"; label: string };

export type CreateEvidenceItemInput = {
  subjectType: string;
  subjectId: string;
  evidenceType: string;
  structuredValue?: unknown;
  excerpt?: string;
  location?: Record<string, unknown>;
  directness: "direct" | "indirect" | "reported" | "unknown";
  sourceReliability: EvidenceReference["sourceQuality"];
  freshness: EvidenceReference["freshness"];
  observedAt?: string;
  retrievedAt: string;
  contentHash: string;
  visibility: "public" | "workspace_private";
  source: EvidenceSource;
};

export type EvidenceItemRecord = CreateEvidenceItemInput & {
  id: string;
  workspaceId: string;
  createdAt: string;
};

const evidenceSelect =
  "id,workspace_id,subject_type,subject_id,company_source_id,document_chunk_id,provider_execution_id,manual_source_label,evidence_type,structured_value_json,excerpt,location_json,directness,source_reliability,freshness_state,observed_at,retrieved_at,content_hash,visibility,created_at";

export async function createEvidenceItem(
  workspaceId: string,
  input: CreateEvidenceItemInput,
): Promise<EvidenceItemRecord> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const db = supabase as unknown as DynamicDatabaseClient;
  const { data, error } = await db
    .from("evidence_items")
    .insert(toEvidenceInsert(workspaceId, input))
    .select(evidenceSelect)
    .single();
  if (error) throw new Error(`Could not create evidence item: ${error.message}`);
  return mapEvidence(data);
}

export async function listEvidenceForSubject(
  workspaceId: string,
  subjectType: string,
  subjectId: string,
): Promise<EvidenceItemRecord[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const db = supabase as unknown as DynamicDatabaseClient;
  const { data, error } = await db
    .from("evidence_items")
    .select(evidenceSelect)
    .eq("workspace_id", workspaceId)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("retrieved_at", { ascending: false });
  if (error) throw new Error(`Could not load evidence items: ${error.message}`);
  return ((data ?? []) as unknown[]).map(mapEvidence);
}

function toEvidenceInsert(workspaceId: string, input: CreateEvidenceItemInput) {
  return {
    workspace_id: workspaceId,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    company_source_id:
      input.source.kind === "company_source" ? input.source.companySourceId : null,
    document_chunk_id:
      input.source.kind === "document_chunk" ? input.source.documentChunkId : null,
    provider_execution_id:
      input.source.kind === "provider_execution"
        ? input.source.providerExecutionId
        : null,
    manual_source_label: input.source.kind === "manual" ? input.source.label : null,
    evidence_type: input.evidenceType,
    structured_value_json: input.structuredValue ?? null,
    excerpt: input.excerpt ?? null,
    location_json: input.location ?? {},
    directness: input.directness,
    source_reliability: input.sourceReliability,
    freshness_state: input.freshness,
    observed_at: input.observedAt ?? null,
    retrieved_at: input.retrievedAt,
    content_hash: input.contentHash,
    visibility: input.visibility,
  };
}

function mapEvidence(value: unknown): EvidenceItemRecord {
  const row = value as Record<string, unknown>;
  const source: EvidenceSource = row.company_source_id
    ? { kind: "company_source", companySourceId: String(row.company_source_id) }
    : row.document_chunk_id
      ? { kind: "document_chunk", documentChunkId: String(row.document_chunk_id) }
      : row.provider_execution_id
        ? {
            kind: "provider_execution",
            providerExecutionId: String(row.provider_execution_id),
          }
        : { kind: "manual", label: String(row.manual_source_label) };
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    evidenceType: String(row.evidence_type),
    structuredValue: row.structured_value_json ?? undefined,
    excerpt: row.excerpt ? String(row.excerpt) : undefined,
    location: (row.location_json ?? {}) as Record<string, unknown>,
    directness: row.directness as EvidenceItemRecord["directness"],
    sourceReliability: row.source_reliability as EvidenceItemRecord["sourceReliability"],
    freshness: row.freshness_state as EvidenceItemRecord["freshness"],
    observedAt: row.observed_at ? String(row.observed_at) : undefined,
    retrievedAt: String(row.retrieved_at),
    contentHash: String(row.content_hash),
    visibility: row.visibility as EvidenceItemRecord["visibility"],
    source,
    createdAt: String(row.created_at),
  };
}

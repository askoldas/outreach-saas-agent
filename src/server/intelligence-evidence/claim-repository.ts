import type { IntelligenceClaim } from "@/lib/intelligence/contracts";
import { intelligenceClaimSchema } from "@/lib/intelligence/contracts";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { DynamicDatabaseClient } from "./database";

export type ClaimOrigin =
  | "user"
  | "official_source"
  | "third_party_source"
  | "ai_inference"
  | "legacy_import"
  | "system";

export type CreateClaimInput = Omit<
  IntelligenceClaim,
  "evidenceIds" | "counterEvidenceIds"
> & {
  subjectType: string;
  subjectId: string;
  claimKey: string;
  originType: ClaimOrigin;
  originId?: string;
  supersedesClaimId?: string;
  evidence: Array<{
    evidenceId: string;
    stance: "supports" | "contradicts" | "contextual";
    weight?: number;
  }>;
};

export async function createIntelligenceClaim(
  workspaceId: string,
  input: CreateClaimInput,
) {
  intelligenceClaimSchema.parse({
    claimId: input.claimId,
    fieldPath: input.fieldPath,
    statement: input.statement,
    value: input.value,
    epistemicStatus: input.epistemicStatus,
    confidence: input.confidence,
    evidenceIds: input.evidence
      .filter((item) => item.stance === "supports")
      .map((item) => item.evidenceId),
    counterEvidenceIds: input.evidence
      .filter((item) => item.stance === "contradicts")
      .map((item) => item.evidenceId),
    conciseRationale: input.conciseRationale,
  });

  const { supabase } = await createAuthenticatedDatabaseClient();
  const db = supabase as unknown as DynamicDatabaseClient;
  const { data, error } = await db.rpc("create_intelligence_claim_with_evidence", {
    target_claim_id: input.claimId,
    target_workspace_id: workspaceId,
    target_subject_type: input.subjectType,
    target_subject_id: input.subjectId,
    target_claim_key: input.claimKey,
    target_field_path: input.fieldPath,
    target_statement: input.statement,
    target_value_json: input.value ?? null,
    target_epistemic_status: input.epistemicStatus,
    target_confidence: input.confidence,
    target_origin_type: input.originType,
    target_origin_id: input.originId ?? null,
    target_concise_rationale: input.conciseRationale ?? null,
    target_supersedes_claim_id: input.supersedesClaimId ?? null,
    evidence_links: input.evidence,
  });
  if (error) throw new Error(`Could not create intelligence claim: ${error.message}`);
  return String(data);
}

export async function listClaimsForSubject(
  workspaceId: string,
  subjectType: string,
  subjectId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const db = supabase as unknown as DynamicDatabaseClient;
  const { data, error } = await db
    .from("intelligence_claims")
    .select(
      "id,workspace_id,subject_type,subject_id,claim_key,field_path,statement,value_json,epistemic_status,lifecycle_status,confidence,origin_type,origin_id,concise_rationale,supersedes_claim_id,created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load intelligence claims: ${error.message}`);
  return (data ?? []) as unknown[];
}

import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { DynamicDatabaseClient } from "./database";

export async function createClaimConflict(input: {
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  claimKey: string;
  firstClaimId: string;
  secondClaimId: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const db = supabase as unknown as DynamicDatabaseClient;
  const { data, error } = await db
    .from("claim_conflicts")
    .insert({
      workspace_id: input.workspaceId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      claim_key: input.claimKey,
      first_claim_id: input.firstClaimId,
      second_claim_id: input.secondClaimId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create claim conflict: ${error.message}`);
  return String((data as Record<string, unknown>).id);
}

export async function resolveClaimConflict(input: {
  workspaceId: string;
  conflictId: string;
  resolution: string;
  winningClaimId?: string;
  userId: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const db = supabase as unknown as DynamicDatabaseClient;
  const { error } = await db
    .from("claim_conflicts")
    .update({
      status: "resolved",
      resolution: input.resolution,
      winning_claim_id: input.winningClaimId ?? null,
      resolved_by_user_id: input.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.conflictId);
  if (error) throw new Error(`Could not resolve claim conflict: ${error.message}`);
}

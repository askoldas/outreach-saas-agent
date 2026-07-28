"use server";

import { redirect } from "next/navigation";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type RollbackRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ error: { message: string } | null }>;
};

export async function rollbackWorkspaceIntelligenceAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  if (String(formData.get("confirmation") ?? "") !== "ROLLBACK") {
    redirect("/settings?error=Type+ROLLBACK+to+confirm");
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 8) redirect("/settings?error=Add+a+specific+rollback+reason");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await (supabase as unknown as RollbackRpcClient).rpc(
    "rollback_workspace_intelligence_v2",
    {
      target_reason: reason,
      target_workspace_id: currentWorkspace.id,
    },
  );
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings?message=V2+workspace+routing+rolled+back+to+V1");
}

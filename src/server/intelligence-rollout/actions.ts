"use server";

import { redirect } from "next/navigation";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { getControlledBetaReadiness } from "./readiness";

type RollbackRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ error: { message: string } | null }>;
};

export async function enableWorkspaceControlledBetaAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  if (String(formData.get("confirmation") ?? "") !== "ENABLE V2 BETA") {
    redirect("/settings?error=Type+ENABLE+V2+BETA+to+confirm");
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 16) {
    redirect("/settings?error=Add+a+specific+controlled-beta+authorization+reason");
  }
  const readiness = await getControlledBetaReadiness(currentWorkspace.id);
  const remainingBlockers = readiness.gates.filter(
    (gate) => ["provider_calls", "model_calls"].includes(gate.key) && !gate.passed,
  );
  if (remainingBlockers.length) {
    redirect(
      `/settings?error=${encodeURIComponent(
        `Controlled beta remains blocked: ${remainingBlockers
          .map((gate) => gate.label)
          .join(", ")}`,
      )}`,
    );
  }
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await (supabase as unknown as RollbackRpcClient).rpc(
    "enable_workspace_controlled_beta_v2",
    {
      target_benchmark_waived: true,
      target_reason: reason,
      target_workspace_id: currentWorkspace.id,
    },
  );
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect("/settings?message=Controlled+V2+beta+enabled+for+this+workspace");
}

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

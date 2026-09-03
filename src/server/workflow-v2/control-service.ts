import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { cancelTriggerRuns, dispatchCampaignV2Resume } from "@/server/trigger/dispatch";
import { finalizeCompanyResearchOutcome } from "@/server/credits/repository";
import { loadCompanyResearchOutcomeProgress } from "@/server/company-research/outcome-progress";

type WorkflowCommand = "pause" | "resume" | "cancel";

export async function controlActiveCampaignWorkflowV2(input: {
  campaignExternalId: string;
  command: WorkflowCommand;
  workspaceId: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignExternalId)
    .single();
  if (campaignError)
    throw new Error(`Could not resolve V2 Campaign control: ${campaignError.message}`);
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select("id,workflow_version")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaign.id)
    .eq("workflow_version", "v2")
    .not("status", "in", '("completed","partially_completed","failed","cancelled")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError)
    throw new Error(`Could not load active V2 Campaign Run: ${runError.message}`);
  if (!run) return null;

  const database = supabase as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>;
  };
  const { data: command, error } = await database.rpc(
    "request_campaign_workflow_command_v2",
    {
      target_command_type: input.command,
      target_payload: {},
      target_campaign_run_id: run.id,
      target_workspace_id: input.workspaceId,
    },
  );
  if (error || !command)
    throw new Error(`Could not request V2 Campaign control: ${error?.message}`);

  if (input.command === "resume") {
    await dispatchCampaignV2Resume({
      campaignRunId: run.id,
      commandId: command.id,
      workspaceId: input.workspaceId,
    });
  }
  if (input.command === "cancel") {
    const triggerRunIds = await activeTriggerRunIds(run.id, input.workspaceId);
    const service = createServiceRoleClient();
    const serviceRpc = service as unknown as {
      rpc(
        fn: string,
        args: Record<string, unknown>,
      ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
    const { error: consumeError } = await serviceRpc.rpc(
      "consume_campaign_workflow_control_v2",
      {
        target_workflow_run_id: await workflowRunId(run.id, input.workspaceId),
        target_workspace_id: input.workspaceId,
      },
    );
    if (consumeError)
      throw new Error(
        `Could not apply V2 Campaign cancellation: ${consumeError.message}`,
      );
    const outcome = await loadCompanyResearchOutcomeProgress({
      workspaceId: input.workspaceId,
      campaignRunId: run.id,
    });
    if (outcome.authorized && !outcome.settled) {
      await finalizeCompanyResearchOutcome({
        workspaceId: input.workspaceId,
        campaignRunId: run.id,
        completionReason: "user_stopped",
      });
    }
    await cancelTriggerRuns(triggerRunIds);
  }
  return { commandId: command.id, command: input.command, runId: run.id };
}

async function workflowRunId(campaignRunId: string, workspaceId: string) {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("intelligence_workflow_runs")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", campaignRunId)
    .single();
  if (error) throw new Error(`Could not resolve V2 workflow: ${error.message}`);
  return data.id;
}

async function activeTriggerRunIds(campaignRunId: string, workspaceId: string) {
  const service = createServiceRoleClient();
  const { data: workflow, error } = await service
    .from("intelligence_workflow_runs")
    .select("id,trigger_run_id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", campaignRunId)
    .single();
  if (error) throw new Error(`Could not load active V2 Trigger runs: ${error.message}`);
  const { data: tasks, error: taskError } = await service
    .from("intelligence_task_runs")
    .select("trigger_run_id")
    .eq("workspace_id", workspaceId)
    .eq("workflow_run_id", workflow.id)
    .in("status", ["pending", "claimed", "running", "retry_wait"]);
  if (taskError)
    throw new Error(`Could not load active V2 child runs: ${taskError.message}`);
  return [
    workflow.trigger_run_id ?? "",
    ...(tasks ?? []).map(({ trigger_run_id }) => trigger_run_id ?? ""),
  ];
}

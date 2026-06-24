import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ResearchProgress } from "@/types/domain";

type ResearchRunRow = {
  id: string;
  status: ResearchProgress["status"];
  progress: number;
  current_step: string;
  error_message: string | null;
};

type ResearchTaskRow = {
  status: "cancelled" | "completed" | "failed" | "pending" | "retrying" | "running";
};

export async function enqueueCampaignDiscoveryRun(input: {
  campaignId: string;
  desiredLeadCount: number;
  workspaceId: string;
}): Promise<{ runId: string }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .insert({
      campaign_id: input.campaignId,
      current_step: "Queued lead discovery",
      progress: 0,
      status: "pending",
      workspace_id: input.workspaceId,
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(`Could not create research run: ${runError.message}`);
  }

  const runId = (run as { id: string }).id;
  const { error: taskError } = await supabase.from("research_tasks").insert({
    campaign_id: input.campaignId,
    max_attempts: 3,
    payload_json: {
      desiredLeadCount: input.desiredLeadCount,
    },
    run_id: runId,
    status: "pending",
    task_type: "search_web",
    workspace_id: input.workspaceId,
  });

  if (taskError) {
    throw new Error(`Could not enqueue research task: ${taskError.message}`);
  }

  return { runId };
}

export async function getCampaignResearchProgress(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<ResearchProgress | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .select("id,status,progress,current_step,error_message")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    throw new Error(`Could not load research run progress: ${runError.message}`);
  }

  if (!run) {
    return null;
  }

  const runRow = run as ResearchRunRow;
  const { data: tasks, error: tasksError } = await supabase
    .from("research_tasks")
    .select("status")
    .eq("workspace_id", input.workspaceId)
    .eq("run_id", runRow.id);

  if (tasksError) {
    throw new Error(`Could not load research task progress: ${tasksError.message}`);
  }

  const taskRows = (tasks ?? []) as ResearchTaskRow[];

  return {
    completedTasks: taskRows.filter((task) => task.status === "completed").length,
    currentStep: runRow.current_step,
    failedTasks: taskRows.filter((task) => task.status === "failed").length,
    lastError: runRow.error_message ?? "",
    progress: runRow.progress,
    runId: runRow.id,
    status: runRow.status,
    totalTasks: taskRows.length,
  };
}

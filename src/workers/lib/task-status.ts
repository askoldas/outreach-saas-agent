import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchTaskRow } from "./claim-task.ts";

export async function completeTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  result: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("research_tasks")
    .update({
      completed_at: new Date().toISOString(),
      error_message: null,
      locked_by: null,
      locked_until: null,
      result_json: result,
      status: "completed",
    })
    .eq("id", task.id);

  if (error) {
    throw new Error(`Could not complete task ${task.id}: ${error.message}`);
  }

  await refreshRunProgress(supabase, task.run_id);
}

export async function failOrRetryTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Task failed";
  const willRetry = task.attempt_count < task.max_attempts;
  const { error: updateError } = await supabase
    .from("research_tasks")
    .update({
      completed_at: willRetry ? null : new Date().toISOString(),
      error_message: message,
      locked_by: null,
      locked_until: null,
      status: willRetry ? "retrying" : "failed",
    })
    .eq("id", task.id);

  if (updateError) {
    throw new Error(`Could not fail task ${task.id}: ${updateError.message}`);
  }

  await refreshRunProgress(supabase, task.run_id);
}

export async function updateRunStep(
  supabase: SupabaseClient,
  runId: string,
  currentStep: string,
  progress: number,
) {
  const { error } = await supabase
    .from("research_runs")
    .update({
      current_step: currentStep,
      progress,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Could not update research run ${runId}: ${error.message}`);
  }
}

async function refreshRunProgress(supabase: SupabaseClient, runId: string) {
  const { data, error } = await supabase
    .from("research_tasks")
    .select("status,error_message")
    .eq("run_id", runId);

  if (error) {
    throw new Error(`Could not load tasks for run ${runId}: ${error.message}`);
  }

  const tasks = (data ?? []) as Array<{
    error_message: string | null;
    status: "cancelled" | "completed" | "failed" | "pending" | "retrying" | "running";
  }>;
  const total = Math.max(tasks.length, 1);
  const completed = tasks.filter((task) => task.status === "completed").length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const hasOpenTasks = tasks.some((task) =>
    ["pending", "retrying", "running"].includes(task.status),
  );
  const status = failed > 0 && !hasOpenTasks ? "failed" : hasOpenTasks ? "running" : "completed";
  const lastError = [...tasks].reverse().find((task) => task.error_message)?.error_message ?? null;

  const { error: runError } = await supabase
    .from("research_runs")
    .update({
      completed_at: status === "completed" || status === "failed" ? new Date().toISOString() : null,
      current_step:
        status === "completed"
          ? "Discovery completed"
          : status === "failed"
            ? "Discovery failed"
            : "Discovery running",
      error_message: lastError,
      progress: Math.round((completed / total) * 100),
      status,
    })
    .eq("id", runId);

  if (runError) {
    throw new Error(`Could not update run progress ${runId}: ${runError.message}`);
  }
}

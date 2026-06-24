import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceRoleClient } from "../lib/supabase/service.ts";
import { claimNextResearchTask } from "./lib/claim-task.ts";
import { getWorkerConfig } from "./lib/worker-config.ts";
import { sleep } from "./lib/sleep.ts";
import { completeTask, failOrRetryTask } from "./lib/task-status.ts";
import { processEnrichContactsTask } from "./tasks/enrich-contacts.ts";
import { processEvaluateLeadTask } from "./tasks/evaluate-lead.ts";
import { processSearchWebTask } from "./tasks/search-web.ts";

loadLocalEnv();
const { pollIntervalMs, workerId } = getWorkerConfig();
const supabase = createServiceRoleClient();

console.info(`[research-worker] starting`, {
  pollIntervalMs,
  workerId,
});

while (true) {
  try {
    const task = await claimNextResearchTask(supabase, workerId);

    if (!task) {
      await sleep(pollIntervalMs);
      continue;
    }

    console.info(`[research-worker] claimed task`, {
      attempt: task.attempt_count,
      taskId: task.id,
      taskType: task.task_type,
    });

    try {
      const result = await processTask(task);
      await completeTask(supabase, task, result);
      console.info(`[research-worker] completed task`, {
        taskId: task.id,
        taskType: task.task_type,
      });
    } catch (error) {
      console.error(`[research-worker] task failed`, {
        error,
        taskId: task.id,
        taskType: task.task_type,
      });
      await failOrRetryTask(supabase, task, error);
    }
  } catch (error) {
    console.error(`[research-worker] loop error`, error);
    await sleep(pollIntervalMs);
  }
}

async function processTask(task: Awaited<ReturnType<typeof claimNextResearchTask>>) {
  if (!task) {
    return {};
  }

  if (task.task_type === "search_web") {
    return processSearchWebTask(supabase, task);
  }

  if (task.task_type === "evaluate_lead") {
    return processEvaluateLeadTask(supabase, task);
  }

  if (task.task_type === "enrich_contacts") {
    return processEnrichContactsTask(supabase, task);
  }

  throw new Error(`Unsupported research task type: ${task.task_type}`);
}

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), filename);

    if (!existsSync(path)) {
      continue;
    }

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
        continue;
      }

      const [name, ...valueParts] = trimmedLine.split("=");

      if (!name || process.env[name]) {
        continue;
      }

      process.env[name] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
const workspaceId = process.argv[2];
if (!workspaceId) throw new Error("workspace ID is required");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service configuration is missing");
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: profile, error: profileError } = await supabase
  .from("company_profiles")
  .select("current_v3_draft_id")
  .eq("workspace_id", workspaceId)
  .single();
if (profileError) throw profileError;
const draftId = profile.current_v3_draft_id;
const [{ data: draft, error: draftError }, { data: stages, error: stageError }] =
  await Promise.all([
    supabase
      .from("company_profile_drafts")
      .select("id,state,created_by_run_id,created_at,updated_at")
      .eq("id", draftId)
      .single(),
    supabase
      .from("profile_task_runs")
      .select(
        "id,task_id,status,attempt_count,started_at,completed_at,error_code,error_message,prompt_version,schema_version",
      )
      .eq("profile_draft_id", draftId)
      .order("created_at", { ascending: true }),
  ]);
if (draftError) throw draftError;
if (stageError) throw stageError;
console.log(JSON.stringify({ draft, stages }, null, 2));

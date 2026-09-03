import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";

const outcomeProgressSchema = z
  .object({
    schemaVersion: z.literal(1),
    authorized: z.boolean(),
    requestedCompanyCount: z.number().int().min(1),
    deliveredCompanyCount: z.number().int().nonnegative(),
    targetReached: z.boolean(),
    settled: z.boolean(),
  })
  .strict();

export type CompanyResearchOutcomeProgress = z.infer<typeof outcomeProgressSchema>;

/** Reads and atomically persists the distinct canonical-company outcome count. */
export async function loadCompanyResearchOutcomeProgress(input: {
  campaignRunId: string;
  workspaceId: string;
}): Promise<CompanyResearchOutcomeProgress> {
  const client = createServiceRoleClient() as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await client.rpc("get_company_research_outcome_progress", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
  });
  if (error) throw new Error(`Could not load Company Research outcome: ${error.message}`);
  return outcomeProgressSchema.parse(data);
}

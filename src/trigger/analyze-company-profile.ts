import { task } from "@trigger.dev/sdk";
import { executeCompanyProfileAnalysis } from "@/server/company-profile/analysis-service";
import { runProviderTask } from "@/server/execution/run-provider-task";

export type AnalyzeCompanyProfilePayload = {
  providerExecutionId: string;
};

export const analyzeCompanyProfileTask = task({
  id: "analyze-company-profile",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: AnalyzeCompanyProfilePayload) => {
    if (!payload.providerExecutionId) throw new Error("providerExecutionId is required.");
    return runProviderTask(payload.providerExecutionId, "company_profile_analysis", () =>
      executeCompanyProfileAnalysis(payload.providerExecutionId),
    );
  },
});

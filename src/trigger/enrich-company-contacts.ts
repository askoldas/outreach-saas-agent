import { task } from "@trigger.dev/sdk";
import { executeContactEnrichment } from "@/server/contact-enrichment/service";
import { runProviderTask } from "@/server/execution/run-provider-task";

export type EnrichCompanyContactsPayload = {
  providerExecutionId: string;
};

export const enrichCompanyContactsTask = task({
  id: "enrich-company-contacts",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: EnrichCompanyContactsPayload) => {
    if (!payload.providerExecutionId) throw new Error("providerExecutionId is required.");
    return runProviderTask(payload.providerExecutionId, "contact_enrichment", () =>
      executeContactEnrichment(payload.providerExecutionId),
    );
  },
});

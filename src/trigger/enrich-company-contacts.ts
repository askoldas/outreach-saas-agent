import { task } from "@trigger.dev/sdk";
import { executeContactEnrichment } from "@/server/contact-enrichment/service";
import {
  finalizeProviderTaskFailure,
  runProviderTask,
} from "@/server/execution/run-provider-task";

export type EnrichCompanyContactsPayload = {
  providerExecutionId: string;
};

export const enrichCompanyContactsTask = task<
  "enrich-company-contacts",
  EnrichCompanyContactsPayload,
  Awaited<ReturnType<typeof executeContactEnrichment>>
>({
  id: "enrich-company-contacts",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  onFailure: async ({ payload, error }) =>
    finalizeProviderTaskFailure(payload.providerExecutionId, "contact_enrichment", error),
  run: async (payload: EnrichCompanyContactsPayload, { ctx }) => {
    if (!payload.providerExecutionId) throw new Error("providerExecutionId is required.");
    return runProviderTask(payload.providerExecutionId, "contact_enrichment", ctx, () =>
      executeContactEnrichment(payload.providerExecutionId),
    );
  },
});

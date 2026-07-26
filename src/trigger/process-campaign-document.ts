import { task } from "@trigger.dev/sdk";
import { processCampaignDocument } from "@/server/documents/processing-service";

export type ProcessCampaignDocumentPayload = { documentId: string };

export const processCampaignDocumentTask = task({
  id: "process-campaign-document",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 15_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: ProcessCampaignDocumentPayload) => {
    if (!payload.documentId) throw new Error("documentId is required.");
    return processCampaignDocument(payload.documentId);
  },
});

import { tasks } from "@trigger.dev/sdk";
import { randomUUID } from "node:crypto";
import { DOCUMENT_LIMITS } from "@/lib/documents/text-chunker";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { processCampaignDocumentTask } from "@/trigger/process-campaign-document";

const supportedTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export type CampaignDocument = {
  fileName: string;
  id: string;
  status: string;
};

export async function uploadCampaignDocument(input: {
  campaignExternalId: string;
  file: File;
  workspaceId: string;
}) {
  if (!supportedTypes.has(input.file.type))
    throw new Error("Supported document types are TXT, Markdown, CSV, and JSON.");
  if (input.file.size < 1 || input.file.size > DOCUMENT_LIMITS.maxBytes)
    throw new Error("Document must be between 1 byte and 1 MB.");
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignExternalId)
    .single();
  if (campaignError) throw new Error(`Could not load Campaign: ${campaignError.message}`);
  const documentId = randomUUID();
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const storagePath = `${input.workspaceId}/campaigns/${campaign.id}/${documentId}/${safeName}`;
  const { error: rowError } = await supabase.from("documents").insert({
    id: documentId,
    workspace_id: input.workspaceId,
    campaign_id: campaign.id,
    storage_path: storagePath,
    file_name: input.file.name.slice(0, 255),
    media_type: input.file.type,
    size_bytes: input.file.size,
    status: "uploaded",
    created_by: user.id,
  });
  if (rowError) throw new Error(`Could not register document: ${rowError.message}`);
  const { error: uploadError } = await supabase.storage
    .from("workspace-documents")
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) {
    await supabase
      .from("documents")
      .update({ status: "failed", metadata: { error: uploadError.message } })
      .eq("workspace_id", input.workspaceId)
      .eq("id", documentId);
    throw new Error(`Could not upload document: ${uploadError.message}`);
  }
  const handle = await tasks.trigger<typeof processCampaignDocumentTask>(
    "process-campaign-document",
    { documentId },
    {
      idempotencyKey: `process-campaign-document:${documentId}`,
      tags: [`workspace:${input.workspaceId}`, `campaign:${campaign.id}`],
    },
  );
  await supabase
    .from("documents")
    .update({ metadata: { triggerRunId: handle.id } })
    .eq("workspace_id", input.workspaceId)
    .eq("id", documentId);
  return documentId;
}

export async function listCampaignDocuments(input: {
  campaignExternalId: string;
  workspaceId: string;
}): Promise<CampaignDocument[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id,file_name,status,campaigns!inner(external_id)")
    .eq("workspace_id", input.workspaceId)
    .eq("campaigns.external_id", input.campaignExternalId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load Campaign documents: ${error.message}`);
  return (data ?? []).map((item) => ({
    fileName: item.file_name,
    id: item.id,
    status: item.status,
  }));
}

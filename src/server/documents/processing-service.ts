import { createHash } from "node:crypto";
import { chunkDocumentText } from "@/lib/documents/text-chunker";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function processCampaignDocument(documentId: string) {
  const supabase = createServiceRoleClient();
  const { data: document, error: loadError } = await supabase
    .from("documents")
    .select("id,workspace_id,storage_bucket,storage_path,status")
    .eq("id", documentId)
    .single();
  if (loadError) throw new Error(`Could not load document: ${loadError.message}`);
  if (document.status === "ready") return { documentId, status: "ready" };
  await updateStatus(document.id, document.workspace_id, "processing");
  try {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(document.storage_bucket)
      .download(document.storage_path);
    if (downloadError)
      throw new Error(`Could not download document: ${downloadError.message}`);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await blob.arrayBuffer(),
    );
    const chunks = chunkDocumentText(text);
    const checksum = createHash("sha256").update(text).digest("hex");
    const { error: chunksError } = await supabase.from("document_chunks").upsert(
      chunks.map((content, chunkIndex) => ({
        workspace_id: document.workspace_id,
        document_id: document.id,
        chunk_index: chunkIndex,
        content,
        metadata: { parser: "bounded_utf8_v1" },
      })),
      { onConflict: "document_id,chunk_index" },
    );
    if (chunksError)
      throw new Error(`Could not save document chunks: ${chunksError.message}`);
    const { error: readyError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        checksum,
        metadata: { parser: "bounded_utf8_v1", chunkCount: chunks.length },
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", document.workspace_id)
      .eq("id", document.id);
    if (readyError) throw new Error(`Could not complete document: ${readyError.message}`);
    return { chunkCount: chunks.length, documentId, status: "ready" };
  } catch (error) {
    await updateStatus(document.id, document.workspace_id, "failed", error);
    throw error;
  }
}

async function updateStatus(
  documentId: string,
  workspaceId: string,
  status: "processing" | "failed",
  failure?: unknown,
) {
  const message = failure instanceof Error ? failure.message.slice(0, 1_000) : undefined;
  const { error } = await createServiceRoleClient()
    .from("documents")
    .update({
      status,
      metadata: message ? { error: message } : {},
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", documentId);
  if (error) throw new Error(`Could not update document status: ${error.message}`);
}

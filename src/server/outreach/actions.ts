"use server";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import {
  createExportRecord,
  recordUsageEvent,
  saveRecipientSelection,
} from "./repository";
import { enqueueLeadContactEnrichmentRun } from "@/server/research/repository";
import { enqueueCampaignDraftGenerationRun } from "@/server/research/repository";
import { estimateCredits } from "@/lib/opptium/domain";
import { getLead } from "@/server/leads/repository";

export async function acceptRecipientSelectionsAction(input: {
  campaignId: string;
  selections: Array<{ leadId: string; contactRouteId: string | null; reason: string }>;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  await Promise.all(
    input.selections.map((selection) =>
      saveRecipientSelection(currentWorkspace.id, selection),
    ),
  );
  revalidatePath(`/campaigns/${input.campaignId}/outreach`);
  return {
    message: `Saved ${input.selections.length} recipient selection${input.selections.length === 1 ? "" : "s"}.`,
  };
}

export async function createExportAction(input: {
  campaignId: string;
  type: "outreach_csv" | "lead_research_csv";
  fileName: string;
  rows: unknown[];
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { user } = await createAuthenticatedDatabaseClient();
  const id = await createExportRecord(currentWorkspace.id, user.id, input);
  await recordUsageEvent(currentWorkspace.id, user.id, {
    campaignId: input.campaignId,
    operation: "export",
    estimated: 0,
    actual: 0,
    referenceId: id,
  });
  revalidatePath(`/campaigns/${input.campaignId}/outreach`);
  revalidatePath("/usage");
  return { id, message: "Export recorded." };
}

export async function queueContactEnrichmentAction(input: {
  campaignId: string;
  leadIds: string[];
  estimatedCredits: number;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { user } = await createAuthenticatedDatabaseClient();
  const runs = [];
  for (const leadId of input.leadIds) {
    const lead = await getLead(currentWorkspace.id, leadId);
    if (
      !lead ||
      lead.campaignId !== input.campaignId ||
      !["approved", "draft_ready"].includes(lead.status)
    )
      throw new Error("Only approved campaign leads can be enriched.");
    runs.push(
      await enqueueLeadContactEnrichmentRun({ workspaceId: currentWorkspace.id, leadId }),
    );
  }
  await recordUsageEvent(currentWorkspace.id, user.id, {
    campaignId: input.campaignId,
    operation: "contact_enrichment",
    estimated: input.estimatedCredits,
    actual: 0,
    referenceId: runs.map((run) => run.runId).join(","),
  });
  revalidatePath(`/campaigns/${input.campaignId}/outreach`);
  revalidatePath("/usage");
  return {
    message: `Queued enrichment for ${runs.length} approved compan${runs.length === 1 ? "y" : "ies"}.`,
  };
}

export async function queueDraftGenerationAction(input: { campaignId: string }) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { user } = await createAuthenticatedDatabaseClient();
  const run = await enqueueCampaignDraftGenerationRun({
    campaignId: input.campaignId,
    workspaceId: currentWorkspace.id,
  });
  await recordUsageEvent(currentWorkspace.id, user.id, {
    campaignId: input.campaignId,
    operation: "draft_generation",
    estimated: estimateCredits("draft", run.taskCount),
    actual: 0,
    referenceId: run.runId,
  });
  revalidatePath(`/campaigns/${input.campaignId}/outreach`);
  revalidatePath("/usage");
  return {
    message: `Queued ${run.taskCount} grounded draft${run.taskCount === 1 ? "" : "s"}. Refresh after the worker completes.`,
  };
}

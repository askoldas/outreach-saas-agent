"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadStatus } from "@/types/domain";
import { importSampleLeads, updateLeadStatus } from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { enqueueLeadContactEnrichmentRun } from "@/server/research/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type UpdateLeadReviewInput = {
  leadId: string;
  status: LeadStatus;
};

const reviewStatuses = new Set<LeadStatus>([
  "approved",
  "archived",
  "needs_review",
  "rejected",
  "researching",
]);

export async function updateLeadReviewAction(input: UpdateLeadReviewInput) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  if (!input.leadId || !reviewStatuses.has(input.status)) {
    throw new Error("Unsupported lead review action.");
  }

  await updateLeadStatus(currentWorkspace.id, input.leadId, input.status);
  const contactRun =
    input.status === "researching"
      ? await enqueueLeadContactEnrichmentRun({
          leadId: input.leadId,
          workspaceId: currentWorkspace.id,
        })
      : null;
  await createActivityEvent(currentWorkspace.id, {
    description: contactRun
      ? `Lead ${input.leadId} moved to researching and contact enrichment run ${contactRun.runId} was queued.`
      : `Lead ${input.leadId} moved to ${input.status}.`,
    entityExternalId: input.leadId,
    entityType: "lead",
    label: contactRun ? "Lead contact research queued" : "Lead review updated",
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);

  return {
    message:
      input.status === "approved"
        ? "Lead approved"
        : input.status === "rejected"
          ? "Lead rejected"
          : input.status === "researching"
            ? `More research requested${contactRun ? ` (${contactRun.runId.slice(0, 8)})` : ""}`
            : input.status === "archived"
              ? "Lead archived"
              : "Lead sent back to review",
  };
}

export async function importSampleLeadsAction() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  await importSampleLeads(currentWorkspace.id);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  redirect("/leads?message=sample-leads-imported");
}

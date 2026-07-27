"use server";

import { revalidatePath } from "next/cache";
import type { DraftStatus } from "@/types/domain";
import { updateDraft } from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type UpdateDraftReviewInput = {
  body: string;
  campaignId?: string;
  draftId: string;
  status: DraftStatus;
  subject: string;
};

const reviewStatuses = new Set<DraftStatus>(["approved", "edited", "rejected"]);

export async function updateDraftReviewAction(input: UpdateDraftReviewInput) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!input.draftId || subject.length < 2 || body.length < 2) {
    throw new Error("Draft subject and body are required.");
  }

  if (!reviewStatuses.has(input.status)) {
    throw new Error("Unsupported draft status.");
  }

  await updateDraft(currentWorkspace.id, input.draftId, {
    body,
    status: input.status,
    subject,
  });
  await createActivityEvent(currentWorkspace.id, {
    description: `Draft ${input.draftId} moved to ${input.status}.`,
    entityExternalId: input.draftId,
    entityType: "draft",
    label: "Draft review updated",
  });

  revalidatePath("/dashboard");
  revalidatePath("/drafts");
  revalidatePath(`/drafts/${input.draftId}`);
  if (input.campaignId) revalidatePath(`/campaigns/${input.campaignId}/outreach`);

  return {
    message:
      input.status === "approved"
        ? "Draft approved"
        : input.status === "rejected"
          ? "Draft rejected"
          : "Draft edits saved",
  };
}

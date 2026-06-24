import { NextResponse } from "next/server";
import { getCampaign } from "@/server/campaigns/repository";
import { getCampaignResearchProgress } from "@/server/research/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  try {
    const { id } = await params;
    const { currentWorkspace } = await getWorkspaceContext();

    if (!currentWorkspace) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const campaign = await getCampaign(currentWorkspace.id, id);

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const progress =
      (await getCampaignResearchProgress({
        campaignId: campaign.id,
        workspaceId: currentWorkspace.id,
      })) ?? {
        completedTasks: 0,
        currentStep: "No discovery run queued",
        failedTasks: 0,
        lastError: "",
        progress: campaign.progress,
        runId: "",
        status: campaign.status === "completed" ? "completed" : "pending",
        totalTasks: 0,
      };

    return NextResponse.json(progress, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load discovery progress",
      },
      { status: 500 },
    );
  }
}

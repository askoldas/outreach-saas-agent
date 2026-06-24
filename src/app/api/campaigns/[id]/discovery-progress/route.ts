import { NextResponse } from "next/server";
import { getCampaign } from "@/server/campaigns/repository";
import { getCampaignDiscoveryProgress } from "@/server/leads/repository";
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

    const progress = await getCampaignDiscoveryProgress(
      currentWorkspace.id,
      campaign.id,
      campaign.desiredLeadCount,
    );

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

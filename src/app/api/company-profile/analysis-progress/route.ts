import { NextResponse } from "next/server";
import { getCampaignResearchProgress } from "@/server/research/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function GET() {
  try {
    const { currentWorkspace } = await getWorkspaceContext();
    if (!currentWorkspace)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const progress = await getCampaignResearchProgress({
      campaignId: "company-profile",
      workspaceId: currentWorkspace.id,
    });
    if (!progress)
      return NextResponse.json({ error: "Analysis run not found" }, { status: 404 });
    return NextResponse.json(progress, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load analysis progress",
      },
      { status: 500 },
    );
  }
}

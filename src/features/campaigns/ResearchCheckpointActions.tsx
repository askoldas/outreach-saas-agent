"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateCampaignStatusAction } from "@/server/campaigns/actions";
import { continueV2CampaignResearchAction } from "@/server/campaign-results-v2/actions";
import { quoteCompanyResearch } from "@/lib/company-research/outcome-pricing";
import { useRouter } from "next/navigation";
import type { CompanyResearchCheckpoint } from "@/server/company-research/checkpoint";
import shared from "@/features/shared/Feature.module.css";

export function ResearchCheckpointActions({
  campaignId,
  checkpoint,
  runId,
}: {
  campaignId: string;
  checkpoint: CompanyResearchCheckpoint;
  runId: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const nextTarget = Math.min(500, checkpoint.requestedCompanyCount + 25);
  const additionalCompanyCount = nextTarget - checkpoint.requestedCompanyCount;
  const nextQuote = quoteCompanyResearch({
    requestedCompanyCount: nextTarget,
    complexity: checkpoint.pricingComplexity,
  });
  const incrementalPrice = Math.max(
    0,
    nextQuote.authorizedCredits - checkpoint.quotedResearchCredits,
  );
  const canFindMore =
    nextTarget > checkpoint.requestedCompanyCount &&
    ["complete", "partial_complete"].includes(checkpoint.status) &&
    checkpoint.completionReason !== "market_exhausted" &&
    checkpoint.completionReason !== "user_stopped";

  function findMore() {
    if (
      !window.confirm(
        `Increase the target to ${nextTarget} companies for up to ${incrementalPrice} additional credits?`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await continueV2CampaignResearchAction({
          campaignExternalId: campaignId,
          campaignRunId: runId,
          requestedCompanyCount: nextTarget,
        });
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not find more companies.",
        );
      }
    });
  }

  function finishResearch() {
    if (
      !window.confirm(
        "Finish research with the current results? Completed work will remain available.",
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await updateCampaignStatusAction({
          campaignId,
          status: "completed",
        });
        setMessage(result.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not finish research.");
      }
    });
  }

  return (
    <section className={shared.stack} aria-label="Research checkpoint actions">
      {canFindMore ? (
        <div>
          <Button disabled={pending} onClick={findMore} variant="primary">
            Find {additionalCompanyCount} more companies
          </Button>
          <p>
            New target: {nextTarget} · incremental estimated price: {incrementalPrice}{" "}
            credits. Existing companies, evidence, and duplicate protection are reused.
          </p>
        </div>
      ) : null}
      {checkpoint.status === "current_pool_complete" ? (
        <p>
          Broaden the target or expand its geography to look for more. Existing discovery
          knowledge and duplicate protection are preserved.
        </p>
      ) : null}
      {checkpoint.status !== "active" && checkpoint.status !== "complete" ? (
        <Button disabled={pending} onClick={finishResearch}>
          Finish with current results
        </Button>
      ) : null}
      {checkpoint.status === "paused_workspace_balance" ? (
        <p>Add workspace credits before continuing. Current results remain available.</p>
      ) : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

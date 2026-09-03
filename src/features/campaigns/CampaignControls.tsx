"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverCampaignLeadsAction,
  updateCampaignStatusAction,
} from "@/server/campaigns/actions";
import type { CampaignStatus, ResearchProgress } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";
import { quoteCompanyResearch } from "@/lib/company-research/outcome-pricing";

export function CampaignControls({
  campaignId,
  initialLeadCount,
  status,
  targetCompanyCount,
}: Readonly<{
  campaignId: string;
  initialLeadCount: number;
  status: CampaignStatus;
  targetCompanyCount: number;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDiscovering, setIsDiscovering] = useState(status === "running");
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [progressError, setProgressError] = useState("");
  const quote = quoteCompanyResearch({ requestedCompanyCount: targetCompanyCount });
  const isWorking = isPending || isDiscovering;
  const displayStatus =
    progress?.status === "waiting_for_input" ? "needs input" : currentStatus;

  async function refreshProgress() {
    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/discovery-progress`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `Progress request failed with ${response.status}`);
    }

    const nextProgress = (await response.json()) as ResearchProgress;
    setProgress(nextProgress);
    setProgressError("");

    if (shouldStopPolling(nextProgress)) {
      setIsDiscovering(false);
      synchronizeStatus(nextProgress, setCurrentStatus);
      router.refresh();
    }

    return nextProgress;
  }

  useEffect(() => {
    if (!isDiscovering) {
      return;
    }

    let cancelled = false;

    async function refreshProgress() {
      try {
        const nextProgress = await fetch(
          `/api/campaigns/${encodeURIComponent(campaignId)}/discovery-progress`,
          { cache: "no-store" },
        );

        if (!cancelled) {
          if (!nextProgress.ok) {
            const payload = (await nextProgress.json().catch(() => ({}))) as {
              error?: string;
            };

            throw new Error(
              payload.error ?? `Progress request failed with ${nextProgress.status}`,
            );
          }

          const payload = (await nextProgress.json()) as ResearchProgress;
          setProgress(payload);
          setProgressError("");

          if (shouldStopPolling(payload)) {
            setIsDiscovering(false);
            synchronizeStatus(payload, setCurrentStatus);
            router.refresh();
          }
        }
      } catch (error) {
        if (!cancelled) {
          setProgressError(
            error instanceof Error ? error.message : "Could not refresh progress",
          );
        }
      }
    }

    void refreshProgress();
    const intervalId = window.setInterval(() => {
      void refreshProgress();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [campaignId, isDiscovering, router]);

  function updateStatus(
    nextStatus: Extract<CampaignStatus, "completed" | "paused" | "running">,
  ) {
    startTransition(async () => {
      try {
        const result = await updateCampaignStatusAction({
          campaignId,
          status: nextStatus,
        });

        setCurrentStatus(nextStatus);
        if (nextStatus === "running") {
          setProgress(null);
          setProgressError("");
          setIsDiscovering(true);
        } else if (nextStatus === "paused" || nextStatus === "completed") {
          setIsDiscovering(false);
        }
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update campaign");
      }
    });
  }

  function stopCampaign() {
    if (
      !window.confirm(
        "Stop this campaign run? Completed discovery results will be preserved.",
      )
    )
      return;
    updateStatus("completed");
  }

  async function discoverLeads() {
    setIsDiscovering(true);
    setCurrentStatus("running");
    setProgress(null);
    setProgressError("");
    setMessage("Company Research queued. Waiting for the worker...");

    try {
      const result = await discoverCampaignLeadsAction({ campaignId });
      setMessage(result.message);

      try {
        await refreshProgress();
      } catch (error) {
        setProgressError(
          error instanceof Error ? error.message : "Could not refresh progress",
        );
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not discover leads");
      setIsDiscovering(false);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <span>
          Find up to <strong>{targetCompanyCount}</strong> qualified companies · estimated
          price {quote.authorizedCredits} credits
        </span>
        <Button
          disabled={isPending || isDiscovering || currentStatus !== "planning"}
          variant="primary"
          onClick={discoverLeads}
        >
          Start Company Research
        </Button>
        <Button
          disabled={isPending || currentStatus !== "running"}
          onClick={() => updateStatus("paused")}
        >
          Pause
        </Button>
        <Button
          disabled={isPending || currentStatus !== "paused"}
          onClick={() => updateStatus("running")}
        >
          Continue
        </Button>
        <Button
          disabled={
            isPending || (currentStatus !== "running" && currentStatus !== "paused")
          }
          onClick={stopCampaign}
        >
          Stop campaign
        </Button>
      </div>
      <Badge tone="accent">
        {isWorking ? message || "Working..." : message || `Status: ${displayStatus}`}
      </Badge>
      {progressError ? (
        <Badge tone="warning">Progress polling: {progressError}</Badge>
      ) : null}
      {isDiscovering || progress ? (
        <div className={styles.stack}>
          <ProgressRow
            label="Confirmed companies"
            value={progress?.companiesQualified ?? initialLeadCount}
            total={targetCompanyCount}
            pending={isDiscovering}
          />
          <span className={styles.secondaryText}>
            {progress?.currentStep ?? "Queued"}{" "}
            {progress?.runId ? `(${progress.runId.slice(0, 8)})` : ""}
            {progress?.lastError ? ` - ${progress.lastError}` : ""}
          </span>
          {progress?.currentIteration ? (
            <span className={styles.secondaryText}>
              Research cycle {progress.currentIteration}
            </span>
          ) : null}
          <span className={styles.secondaryText}>
            {progress?.candidatesDiscovered ?? 0} source records ·{" "}
            {progress?.candidatesUnique ?? 0} unique organizations ·{" "}
            {progress?.candidatesClassified ?? 0} plausible candidates ·{" "}
            {progress?.companiesEvaluated ?? 0} deeply researched ·{" "}
            {progress?.companiesQualified ?? initialLeadCount} / {targetCompanyCount}{" "}
            confirmed
          </span>
        </div>
      ) : null}
    </div>
  );
}

function synchronizeStatus(
  progress: ResearchProgress,
  setStatus: (status: CampaignStatus) => void,
) {
  if (progress.currentStep === "Campaign paused") setStatus("paused");
  else if (progress.status === "completed" || progress.status === "cancelled")
    setStatus("completed");
}

function shouldStopPolling(progress: ResearchProgress) {
  return (
    progress.status === "completed" ||
    progress.status === "failed" ||
    progress.status === "cancelled" ||
    progress.status === "waiting_for_input" ||
    progress.currentStep === "Campaign paused" ||
    progress.currentStep === "Waiting for your targeting clarification"
  );
}

function ProgressRow({
  label,
  pending,
  total,
  value,
}: Readonly<{ label: string; pending: boolean; total: number; value: number }>) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((value / safeTotal) * 100));

  return (
    <div className={styles.stack}>
      <span className={styles.secondaryText}>
        {label}: {value} / {total}
        {pending ? " running" : ""}
      </span>
      <div className={styles.progress} aria-label={`${label} ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

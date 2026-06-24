"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverCampaignLeadsAction,
  updateCampaignStatusAction,
} from "@/server/campaigns/actions";
import type { CampaignStatus, DiscoveryProgress, DiscoveryReport } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function CampaignControls({
  campaignId,
  desiredLeadCount,
  initialLeadCount,
  status,
}: Readonly<{
  campaignId: string;
  desiredLeadCount: number;
  initialLeadCount: number;
  status: CampaignStatus;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [runReport, setRunReport] = useState<DiscoveryReport | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgress | null>({
    contactEnrichedCount: 0,
    desiredLeadCount,
    leadCount: initialLeadCount,
    qualificationAttemptedCount: 0,
    qualifiedCount: 0,
  });
  const [progressError, setProgressError] = useState("");
  const isBusy = isPending || isDiscovering;
  const finalReviewedCount = runReport
    ? runReport.aiQualificationSuccesses.length + runReport.aiQualificationFailures.length
    : 0;

  async function refreshProgress() {
    const response = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/discovery-progress`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        payload.error ?? `Progress request failed with ${response.status}`,
      );
    }

    const nextProgress = (await response.json()) as DiscoveryProgress;
    setProgress(nextProgress);
    setProgressError("");

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

          setProgress((await nextProgress.json()) as DiscoveryProgress);
          setProgressError("");
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
  }, [campaignId, isDiscovering]);

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
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update campaign");
      }
    });
  }

  async function discoverLeads() {
    setIsDiscovering(true);
    setRunReport(null);
    setProgress({
      contactEnrichedCount: 0,
      desiredLeadCount,
      leadCount: initialLeadCount,
      qualificationAttemptedCount: 0,
      qualifiedCount: 0,
    });
    setProgressError("");
    setMessage("Discovery running. Searching, saving, qualifying, and checking contacts...");

    try {
      try {
        await refreshProgress();
      } catch (error) {
        setProgressError(
          error instanceof Error ? error.message : "Could not refresh progress",
        );
      }

      const result = await discoverCampaignLeadsAction(campaignId);
      let finalProgress: DiscoveryProgress | null = null;

      try {
        finalProgress = await refreshProgress();
      } catch (error) {
        setProgressError(
          error instanceof Error ? error.message : "Could not refresh progress",
        );
      }

      setRunReport(result.report);
      if (finalProgress) {
        setProgress(finalProgress);
      }
      setMessage(result.message);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not discover leads");
    } finally {
      setIsDiscovering(false);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Button disabled={isBusy} variant="primary" onClick={discoverLeads}>
          Discover leads
        </Button>
        <Button disabled={isBusy} onClick={() => updateStatus("paused")}>
          Pause
        </Button>
        <Button disabled={isBusy} onClick={() => updateStatus("running")}>
          Continue
        </Button>
        <Button disabled={isBusy} onClick={() => updateStatus("completed")}>
          Complete
        </Button>
      </div>
      <Badge tone="accent">
        {isBusy ? message || "Working..." : message || `Status: ${currentStatus}`}
      </Badge>
      {progressError ? <Badge tone="warning">Progress polling: {progressError}</Badge> : null}
      {isDiscovering || runReport ? (
        <div className={styles.stack}>
          <ProgressRow
            label="Leads saved"
            value={
              progress?.leadCount ??
              runReport?.leadsSavedBeforeAiQualification.length ??
              0
            }
            total={
              progress?.desiredLeadCount ??
              runReport?.leadsSavedBeforeAiQualification.length ??
              desiredLeadCount
            }
            pending={isDiscovering}
          />
          <ProgressRow
            label="AI reviewed"
            value={
              progress?.qualificationAttemptedCount ??
              finalReviewedCount
            }
            total={
              progress?.leadCount ??
              runReport?.leadsSavedBeforeAiQualification.length ??
              initialLeadCount
            }
            pending={isDiscovering}
          />
          <ProgressRow
            label="Contact enrichment"
            value={
              progress?.contactEnrichedCount ??
              runReport?.contactDiscovery.filter((item) => item.routesFound > 0).length ??
              0
            }
            total={
              progress?.leadCount ??
              runReport?.leadsSavedBeforeAiQualification.length ??
              initialLeadCount
            }
            pending={isDiscovering}
          />
        </div>
      ) : null}
    </div>
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

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverCampaignLeadsAction,
  getCampaignDiscoveryProgressAction,
  updateCampaignStatusAction,
} from "@/server/campaigns/actions";
import type { CampaignStatus, DiscoveryProgress, DiscoveryReport } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function CampaignControls({
  campaignId,
  status,
}: Readonly<{ campaignId: string; status: CampaignStatus }>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [runReport, setRunReport] = useState<DiscoveryReport | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const isBusy = isPending || isDiscovering;
  const finalReviewedCount = runReport
    ? runReport.aiQualificationSuccesses.length + runReport.aiQualificationFailures.length
    : 0;

  useEffect(() => {
    if (!isDiscovering) {
      return;
    }

    let cancelled = false;

    async function refreshProgress() {
      try {
        const nextProgress = await getCampaignDiscoveryProgressAction(campaignId);

        if (!cancelled) {
          setProgress(nextProgress);
        }
      } catch {
        // Keep the visible running state even if one polling request fails.
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
    setProgress(null);
    setMessage("Discovery running. Searching, saving, qualifying, and checking contacts...");

    try {
      const result = await discoverCampaignLeadsAction(campaignId);
      const finalProgress = await getCampaignDiscoveryProgressAction(campaignId);

      setRunReport(result.report);
      setProgress(finalProgress);
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
              1
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
              1
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
              1
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

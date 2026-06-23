"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverCampaignLeadsAction,
  updateCampaignStatusAction,
} from "@/server/campaigns/actions";
import type { CampaignStatus, DiscoveryReport } from "@/types/domain";
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
  const isBusy = isPending || isDiscovering;

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
    setMessage("Discovery running. Searching, saving, qualifying, and checking contacts...");

    try {
      const result = await discoverCampaignLeadsAction(campaignId);

      setRunReport(result.report);
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
            value={runReport?.leadsSavedBeforeAiQualification.length ?? 0}
            total={runReport?.rawTavilyResults.length ?? 1}
            pending={isDiscovering}
          />
          <ProgressRow
            label="AI qualified"
            value={runReport?.aiQualificationSuccesses.length ?? 0}
            total={
              runReport
                ? Math.max(runReport.leadsSavedBeforeAiQualification.length, 1)
                : 1
            }
            pending={isDiscovering}
          />
          <ProgressRow
            label="Contact enrichment"
            value={
              runReport?.contactDiscovery.filter((item) => item.routesFound > 0).length ??
              0
            }
            total={
              runReport
                ? Math.max(runReport.leadsSavedBeforeAiQualification.length, 1)
                : 1
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
  const percent = pending ? 35 : Math.min(100, Math.round((value / total) * 100));

  return (
    <div className={styles.stack}>
      <span className={styles.secondaryText}>
        {label}: {pending ? "running" : `${value} / ${total}`}
      </span>
      <div className={styles.progress} aria-label={`${label} ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  discoverCampaignLeadsAction,
  updateCampaignStatusAction,
} from "@/server/campaigns/actions";
import type { CampaignStatus } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function CampaignControls({
  campaignId,
  status,
}: Readonly<{ campaignId: string; status: CampaignStatus }>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);

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

  function discoverLeads() {
    startTransition(async () => {
      try {
        const result = await discoverCampaignLeadsAction(campaignId);

        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not discover leads");
      }
    });
  }

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Button disabled={isPending} variant="primary" onClick={discoverLeads}>
          Discover leads
        </Button>
        <Button disabled={isPending} onClick={() => updateStatus("paused")}>
          Pause
        </Button>
        <Button disabled={isPending} onClick={() => updateStatus("running")}>
          Continue
        </Button>
        <Button disabled={isPending} onClick={() => updateStatus("completed")}>
          Complete
        </Button>
      </div>
      <Badge tone="accent">
        {isPending ? "Saving..." : message || `Status: ${currentStatus}`}
      </Badge>
    </div>
  );
}

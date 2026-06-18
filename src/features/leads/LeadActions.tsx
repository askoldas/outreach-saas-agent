"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadReviewAction } from "@/server/leads/actions";
import type { LeadStatus } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function LeadActions({
  leadId,
  status,
}: Readonly<{ leadId: string; status: LeadStatus }>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);

  function updateStatus(nextStatus: LeadStatus) {
    startTransition(async () => {
      try {
        const result = await updateLeadReviewAction({ leadId, status: nextStatus });

        setCurrentStatus(nextStatus);
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update lead");
      }
    });
  }

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Button
          disabled={isPending}
          variant="primary"
          onClick={() => updateStatus("approved")}
        >
          Approve lead
        </Button>
        <Button
          disabled={isPending}
          variant="danger"
          onClick={() => updateStatus("rejected")}
        >
          Reject
        </Button>
        <Button disabled={isPending} onClick={() => updateStatus("researching")}>
          Request more research
        </Button>
        <Button disabled={isPending} onClick={() => updateStatus("archived")}>
          Archive
        </Button>
      </div>
      <Badge tone="accent">
        {isPending ? "Saving..." : message || `Status: ${currentStatus}`}
      </Badge>
    </div>
  );
}

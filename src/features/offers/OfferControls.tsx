"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOfferStatusAction } from "@/server/offers/actions";
import type { OfferStatus } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function OfferControls({
  offerId,
  status,
}: Readonly<{ offerId: string; status: OfferStatus }>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);

  function updateStatus(nextStatus: OfferStatus) {
    startTransition(async () => {
      try {
        const result = await updateOfferStatusAction({
          offerId,
          status: nextStatus,
        });

        setCurrentStatus(nextStatus);
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update offer");
      }
    });
  }

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Button
          disabled={isPending}
          variant="primary"
          onClick={() => updateStatus("active")}
        >
          Activate
        </Button>
        <Button disabled={isPending} onClick={() => updateStatus("draft")}>
          Move to draft
        </Button>
        <Button
          disabled={isPending}
          variant="danger"
          onClick={() => updateStatus("archived")}
        >
          Archive
        </Button>
      </div>
      <Badge tone="accent">
        {isPending ? "Saving..." : message || `Status: ${currentStatus}`}
      </Badge>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ResearchProgress } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

export function RunProgressPanel({
  endpoint,
  initialProgress,
  title,
}: Readonly<{
  endpoint: string;
  initialProgress: ResearchProgress | null;
  title: string;
}>) {
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState("");
  const active = progress?.status === "pending" || progress?.status === "running";

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const payload = (await response.json()) as ResearchProgress & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not load run progress");
        if (!cancelled) {
          setProgress(payload);
          setError("");
          if (
            ["completed", "failed", "cancelled", "waiting_for_input"].includes(
              payload.status,
            )
          ) {
            window.location.reload();
          }
        }
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Progress failed");
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [active, endpoint]);

  if (!progress) return null;
  const percent = Math.max(0, Math.min(100, progress.progress));
  return (
    <Card>
      <CardHeader
        title={title}
        eyebrow={progress.runId ? `Run ${progress.runId.slice(0, 8)}` : "Latest run"}
        action={
          <Badge
            tone={
              progress.status === "failed" || progress.status === "waiting_for_input"
                ? "warning"
                : "accent"
            }
          >
            {progress.status === "waiting_for_input" ? "needs input" : progress.status}
          </Badge>
        }
      />
      <div className={`${styles.cardBody} ${styles.stack}`}>
        <span className={styles.secondaryText}>{progress.currentStep}</span>
        <div className={styles.progress} aria-label={`${title} ${percent}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.secondaryText}>
          {percent}% · {progress.completedTasks}/{progress.totalTasks} tasks completed
          {progress.failedTasks ? ` · ${progress.failedTasks} failed` : ""}
        </span>
        {progress.lastError ? <Badge tone="warning">{progress.lastError}</Badge> : null}
        {error ? <Badge tone="warning">Progress polling: {error}</Badge> : null}
      </div>
    </Card>
  );
}

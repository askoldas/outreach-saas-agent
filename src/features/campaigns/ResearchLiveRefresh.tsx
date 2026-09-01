"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ACTIVE_STATUSES = new Set(["queued", "running", "in_progress"]);

export function ResearchLiveRefresh({ status }: { status: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!status || !ACTIVE_STATUSES.has(status)) return;
    const interval = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [router, status]);

  return null;
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function LeadActions() {
  const [message, setMessage] = useState("");

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Button variant="primary" onClick={() => setMessage("Lead approved in local prototype state")}>Approve lead</Button>
        <Button variant="danger" onClick={() => setMessage("Lead rejected in local prototype state")}>Reject</Button>
        <Button onClick={() => setMessage("Further research requested in local prototype state")}>Request more research</Button>
        <Button onClick={() => setMessage("Lead archived in local prototype state")}>Archive</Button>
      </div>
      {message ? <Badge tone="accent">{message}</Badge> : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { OutreachDraft } from "@/types/domain";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function DraftEditor({ draft }: Readonly<{ draft: OutreachDraft }>) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [notice, setNotice] = useState("");
  const mailto = useMemo(() => {
    const params = new URLSearchParams({ subject, body });
    return `mailto:${draft.recipientRoute}?${params.toString()}`;
  }, [body, draft.recipientRoute, subject]);

  return (
    <div className={styles.stack}>
      <label className={form.field} htmlFor="draft-subject">
        <span>Subject</span>
        <input
          className={form.input}
          id="draft-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>
      <label className={form.field} htmlFor="draft-body">
        <span>Body</span>
        <textarea
          className={form.textarea}
          id="draft-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          style={{ minHeight: 280 }}
        />
      </label>
      <div className={styles.filters}>
        <Button variant="primary" onClick={() => setNotice("Draft approved locally")}>
          Approve
        </Button>
        <Button variant="danger" onClick={() => setNotice("Draft rejected locally")}>
          Reject
        </Button>
        <Button onClick={() => setNotice("Draft copied locally")}>Copy</Button>
        <a
          className={form.input}
          href={mailto}
          onClick={() => setNotice("Opened external compose; not marked sent")}
        >
          Open in email client
        </a>
      </div>
      {notice ? <Badge tone="accent">{notice}</Badge> : null}
    </div>
  );
}

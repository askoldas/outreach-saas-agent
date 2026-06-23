"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDraftReviewAction } from "@/server/drafts/actions";
import type { DraftStatus, OutreachDraft } from "@/types/domain";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function DraftEditor({ draft }: Readonly<{ draft: OutreachDraft }>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState(draft.status);
  const mailto = useMemo(() => {
    const params = new URLSearchParams({ subject, body });
    return `mailto:${draft.recipientRoute}?${params.toString()}`;
  }, [body, draft.recipientRoute, subject]);

  function updateReview(
    nextStatus: Extract<DraftStatus, "approved" | "edited" | "rejected">,
  ) {
    startTransition(async () => {
      try {
        const result = await updateDraftReviewAction({
          body,
          draftId: draft.id,
          status: nextStatus,
          subject,
        });

        setStatus(nextStatus);
        setNotice(result.message);
        router.refresh();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not update draft");
      }
    });
  }

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
        <Button disabled={isPending} onClick={() => updateReview("edited")}>
          Save edits
        </Button>
        <Button
          disabled={isPending}
          variant="primary"
          onClick={() => updateReview("approved")}
        >
          Approve
        </Button>
        <Button
          disabled={isPending}
          variant="danger"
          onClick={() => updateReview("rejected")}
        >
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
      <Badge tone="accent">
        {isPending ? "Saving..." : notice || `Status: ${status}`}
      </Badge>
    </div>
  );
}

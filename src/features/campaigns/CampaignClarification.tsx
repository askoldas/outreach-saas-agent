"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";
import { answerCampaignQuestionAction } from "@/server/campaign-questions/actions";
import type { OpenCampaignQuestion } from "@/server/campaign-questions/repository";

export function CampaignClarification({
  campaignId,
  question,
}: Readonly<{ campaignId: string; question: OpenCampaignQuestion }>) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function answer(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await answerCampaignQuestionAction(formData);
        setMessage(result.message);
        window.location.reload();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not save clarification.",
        );
      }
    });
  }

  return (
    <form action={answer} className={styles.stack}>
      <strong>Campaign Agent needs your input</strong>
      <span className={styles.secondaryText}>{question.question}</span>
      <input name="campaignId" type="hidden" value={campaignId} />
      <input name="questionId" type="hidden" value={question.id} />
      <label className={form.field}>
        <span>Targeting clarification</span>
        <textarea
          className={form.textarea}
          name="answer"
          placeholder="For example: prioritize Latvian manufacturers with 50–250 employees and exclude agencies."
          required
          rows={3}
        />
      </label>
      {message ? <Badge tone="accent">{message}</Badge> : null}
      <Button disabled={pending} type="submit" variant="primary">
        {pending ? "Resuming…" : "Continue discovery"}
      </Button>
    </form>
  );
}

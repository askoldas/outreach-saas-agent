import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";
import { answerCampaignQuestionAction } from "@/server/campaign-questions/actions";
import type { OpenCampaignQuestion } from "@/server/campaign-questions/repository";

export function CampaignClarification({
  campaignId,
  question,
}: Readonly<{ campaignId: string; question: OpenCampaignQuestion }>) {
  return (
    <form action={answerCampaignQuestionAction} className={styles.stack}>
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
      <Button type="submit" variant="primary">
        Continue discovery
      </Button>
    </form>
  );
}

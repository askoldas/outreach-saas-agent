import { Badge } from "@/components/ui/Badge";
import styles from "@/features/shared/Feature.module.css";
import type { OpenCampaignQuestion } from "@/server/campaign-questions/repository";

export function CampaignClarification({
  question,
}: Readonly<{ campaignId: string; question: OpenCampaignQuestion }>) {
  return (
    <section className={styles.stack}>
      <strong>Historical Campaign Agent clarification</strong>
      <span className={styles.secondaryText}>{question.question}</span>
      <Badge tone="warning">
        This V1 run is preserved for audit history and cannot be resumed.
      </Badge>
    </section>
  );
}

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";
export default function HelpPage() {
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Help"
        description="How Opptium handles research, review, contacts, drafts, and exports."
      />
      <Card>
        <CardHeader title="Human-controlled workflow" eyebrow="Product boundary" />
        <div className={styles.cardBody}>
          <p>
            Opptium prepares evidence-based prospecting work for review and CSV export. It
            does not send email or create mailbox drafts.
          </p>
        </div>
      </Card>
    </div>
  );
}

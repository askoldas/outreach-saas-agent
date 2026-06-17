import { LeadsTable } from "@/features/leads/LeadsTable";
import styles from "@/features/shared/Feature.module.css";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function LeadsPage() {
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Leads"
        description="Review discovered companies with visible fit, confidence, contactability, and status filters."
      />
      <Card>
        <CardHeader title="Review table" eyebrow="Mock lead queue" />
        <div className={styles.cardBody}>
          <LeadsTable />
        </div>
      </Card>
    </div>
  );
}

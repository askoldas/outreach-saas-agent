import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";
import type { CommercialValidationMetrics } from "@/server/usage/repository";

export function CommercialValidation({
  metrics,
}: {
  metrics: CommercialValidationMetrics;
}) {
  const rows = [
    [
      "Qualification acceptance",
      percentage(metrics.qualificationAcceptanceRate),
      `${metrics.approvedCompanies} approved of ${metrics.reviewedCompanies} reviewed`,
    ],
    [
      "Contact-found rate",
      percentage(metrics.contactFoundRate),
      "Approved companies with at least one stored contact route",
    ],
    [
      "Email verification success",
      percentage(metrics.emailVerificationSuccessRate),
      "Valid results among attempted email verifications",
    ],
    [
      "Draft approval rate",
      percentage(metrics.draftApprovalRate),
      "Approved drafts among reviewed drafts",
    ],
    [
      "Draft correction rate",
      percentage(metrics.draftCorrectionRate),
      "Edited drafts among reviewed drafts",
    ],
    [
      "Cost per qualified company",
      metrics.costPerQualifiedCompany === null
        ? "Not enough data"
        : `${metrics.costPerQualifiedCompany.toFixed(4)} recorded currency units`,
      "Completed AI request cost divided by qualified companies",
    ],
  ];

  return (
    <Card>
      <CardHeader
        title="Commercial validation"
        eyebrow="Observed product funnel"
        action={<Badge tone="neutral">Descriptive only</Badge>}
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Observed value</th>
              <th>Definition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value, definition]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value}</td>
                <td>{definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.muted}>
        {metrics.totalCampaigns} campaigns · {metrics.totalCampaignRuns} runs ·{" "}
        {metrics.campaignsWithRepeatRuns} campaigns rerun · {metrics.exportedRows} rows
        exported · {metrics.totalActualCost.toFixed(4)} recorded AI cost
      </p>
    </Card>
  );
}

function percentage(value: number | null) {
  return value === null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

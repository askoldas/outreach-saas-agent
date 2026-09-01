import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { CampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";

export function CampaignRunHistory({
  campaignId,
  runs,
}: {
  campaignId: string;
  runs: CampaignWorkflowSummary["runHistory"];
}) {
  if (!runs.length) return null;
  return (
    <details>
      <summary>
        <strong>Campaign run history ({runs.length})</strong>
      </summary>
      <div className={shared.tableWrap}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Results</th>
              <th>Cost</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, index) => (
              <tr key={run.id}>
                <td>
                  <strong>{run.id.slice(0, 8)}</strong>
                  <span className={shared.secondaryText}>
                    {index === 0 ? "Latest · " : ""}
                    {run.phase.replaceAll("_", " ")}
                    {run.iteration ? ` · iteration ${run.iteration}` : ""}
                  </span>
                  <span className={shared.secondaryText}>
                    <Link href={`/campaigns/${campaignId}/research?run=${run.id}`}>
                      Company Research
                    </Link>{" "}
                    ·{" "}
                    <Link href={`/campaigns/${campaignId}/research?run=${run.id}`}>
                      Evidence audit
                    </Link>
                  </span>
                </td>
                <td>
                  <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                  {run.errorMessage ? (
                    <span className={shared.secondaryText}>{run.errorMessage}</span>
                  ) : null}
                </td>
                <td>
                  <strong>{run.companiesQualified} qualified</strong>
                  <span className={shared.secondaryText}>
                    {run.candidatesDiscovered} discovered · {run.candidatesClassified}{" "}
                    classified · {run.companiesEvaluated} evaluated
                  </span>
                </td>
                <td>{formatMoney(run.totalCost, run.currency)}</td>
                <td>
                  {formatDate(run.createdAt)}
                  <span className={shared.secondaryText}>
                    {run.completedAt
                      ? `Completed ${formatDate(run.completedAt)}`
                      : run.cancelledAt
                        ? `Stopped ${formatDate(run.cancelledAt)}`
                        : "In progress"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function statusTone(status: string): "success" | "warning" | "accent" {
  if (status === "completed" || status === "partially_completed") return "success";
  if (status === "failed" || status === "cancelled") return "warning";
  return "accent";
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

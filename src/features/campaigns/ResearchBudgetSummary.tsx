import { Card } from "@/components/ui/Card";
import type { ResearchBudgetState } from "@/lib/credits/contracts";
import shared from "@/features/shared/Feature.module.css";

export function ResearchBudgetSummary({ budget }: { budget: ResearchBudgetState | null }) {
  if (!budget) return null;
  return <section className={shared.stack} aria-label="Research usage">
    <h3>Research usage</h3>
    <div className={shared.metricGrid}>
      <Card className={shared.metric}><p>Authorized</p><h2>{format(budget.authorizedCredits)}</h2><span>maximum Campaign Research spend</span></Card>
      <Card className={shared.metric}><p>Used</p><h2>{format(budget.consumedCredits)}</h2><span>{format(budget.reservedCredits)} currently reserved</span></Card>
      <Card className={shared.metric}><p>Remaining</p><h2>{format(budget.remainingCampaignCredits)}</h2><span>{format(budget.workspaceAvailableCredits)} workspace credits available</span></Card>
    </div>
  </section>;
}

function format(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
}

import { Card } from "@/components/ui/Card";
import type { getInternalResearchUsage } from "@/server/credits/usage-summary";
import shared from "@/features/shared/Feature.module.css";

type Usage = NonNullable<Awaited<ReturnType<typeof getInternalResearchUsage>>>;
export function InternalResearchUsage({ usage }: { usage: Usage | null }) {
  if (!usage) return null;
  return <details className={shared.stack}>
    <summary><strong>Internal provider economics</strong></summary>
    <div className={shared.metricGrid}>
      <Card className={shared.metric}><p>Research credits</p><h2>{usage.budget.consumedCredits.toFixed(3)} / {usage.budget.authorizedCredits.toFixed(3)}</h2><span>{usage.budget.spendableCredits.toFixed(3)} spendable</span></Card>
      <Card className={shared.metric}><p>Actual API spend</p><h2>${usage.totalActualCostUsd.toFixed(4)}</h2><span>${usage.totalBillableCostUsd.toFixed(4)} billable</span></Card>
    </div>
    {usage.providers.map((item) => <p key={item.provider}><strong>{item.provider}</strong>: {item.calls} calls · ${item.actualCostUsd.toFixed(4)} actual · {item.inputTokens} input · {item.outputTokens} output · {item.reasoningTokens} reasoning · {item.cachedTokens} cached · {item.providerUnits} provider units</p>)}
  </details>;
}

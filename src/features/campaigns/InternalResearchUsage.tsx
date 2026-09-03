import { Card } from "@/components/ui/Card";
import type { getInternalResearchUsage } from "@/server/credits/usage-summary";
import shared from "@/features/shared/Feature.module.css";

type Usage = NonNullable<Awaited<ReturnType<typeof getInternalResearchUsage>>>;

export function InternalResearchUsage({ usage }: { usage: Usage | null }) {
  if (!usage) return null;
  const outcome = usage.outcomeEconomics;
  return (
    <details className={shared.stack}>
      <summary>
        <strong>Internal provider economics</strong>
      </summary>
      <div className={shared.metricGrid}>
        <Card className={shared.metric}>
          <p>Research credits</p>
          <h2>
            {usage.budget.consumedCredits.toFixed(3)} /{" "}
            {usage.budget.authorizedCredits.toFixed(3)}
          </h2>
          <span>{usage.budget.spendableCredits.toFixed(3)} spendable</span>
        </Card>
        <Card className={shared.metric}>
          <p>Actual API spend</p>
          <h2>${usage.totalActualCostUsd.toFixed(4)}</h2>
          <span>${usage.totalBillableCostUsd.toFixed(4)} billable</span>
        </Card>
        <Card className={shared.metric}>
          <p>Cost per qualified company</p>
          <h2>{money(outcome.actualCostPerQualifiedCompany)}</h2>
          <span>{money(outcome.billableCostPerQualifiedCompany)} billable</span>
        </Card>
        <Card className={shared.metric}>
          <p>Outcome yield</p>
          <h2>{percent(outcome.qualificationRate)}</h2>
          <span>
            {outcome.qualifiedCompanies} qualified / {outcome.evaluatedCompanies}{" "}
            evaluated
          </span>
        </Card>
        <Card className={shared.metric}>
          <p>Resolution funnel</p>
          <h2>{outcome.resolvedCompanies}</h2>
          <span>
            {outcome.discoveredCompanies} discovered · {outcome.duplicateCompanies}{" "}
            duplicates
          </span>
        </Card>
        <Card className={shared.metric}>
          <p>Duplicate rate</p>
          <h2>{percent(outcome.duplicateRate)}</h2>
          <span>Across candidate entities</span>
        </Card>
      </div>
      {usage.providers.map((item) => (
        <p key={item.provider}>
          <strong>{item.provider}</strong>: {item.calls} calls · $
          {item.actualCostUsd.toFixed(4)} actual · {item.inputTokens} input ·{" "}
          {item.outputTokens} output · {item.reasoningTokens} reasoning ·{" "}
          {item.cachedTokens} cached · {item.providerUnits} provider units
        </p>
      ))}
      {outcome.channels.length ? (
        <div>
          <h4>Discovery channel yield</h4>
          {outcome.channels.map((channel) => (
            <p key={`${channel.provider}:${channel.sourceType}`}>
              <strong>{label(channel.sourceType)}</strong> · {channel.provider}:{" "}
              {channel.resolvedCompanies} resolved · {channel.qualifiedCompanies}{" "}
              qualified · {percent(channel.qualificationYield)} yield ·{" "}
              {channel.sourceRecords} source records
            </p>
          ))}
          <p>
            A company discovered through several channels is counted once within each
            channel. Provider cost is shown at Run level because existing ledger entries
            do not allocate shared calls safely across sources.
          </p>
        </div>
      ) : null}
    </details>
  );
}

function money(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(4)}`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";
import type { ControlledBetaReadiness } from "@/server/intelligence-rollout/readiness";

export function IntelligenceRolloutReadiness({
  readiness,
}: {
  readiness: ControlledBetaReadiness;
}) {
  return (
    <Card>
      <CardHeader
        title="Intelligence V2 rollout readiness"
        eyebrow="Default workflow"
        action={<Badge tone="success">V2 canonical</Badge>}
      />
      <div className={styles.cardBody}>
        <p>
          Intelligence V2 is the canonical workflow for all new profiles, campaigns, and
          runs. Historical V1 records remain readable, but V1 creation and workspace
          rollback routing are frozen.
        </p>
        <div className={styles.metricGrid}>
          <div className={styles.metric}>
            <p>V2 Campaign Runs</p>
            <h2>{readiness.totalV2Runs}</h2>
            <span>
              {readiness.completedV2Runs} reviewable · {readiness.activeV2Runs} active
            </span>
          </div>
          <div className={styles.metric}>
            <p>Recommended</p>
            <h2>{readiness.recommendedCandidates}</h2>
            <span>Canonical ranked candidates</span>
          </div>
          <div className={styles.metric}>
            <p>User review rate</p>
            <h2>{formatRate(readiness.reviewDecisionRate)}</h2>
            <span>Decisions per ranked candidate</span>
          </div>
          <div className={styles.metric}>
            <p>Correction rate</p>
            <h2>{formatRate(readiness.correctionRate)}</h2>
            <span>Correction proposals per ranked candidate</span>
          </div>
          <div className={styles.metric}>
            <p>Run failure rate</p>
            <h2>{formatRate(readiness.failureRate)}</h2>
            <span>Failed V2 runs per observed run</span>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Canonical V2 operational readiness</caption>
            <thead>
              <tr>
                <th scope="col">Gate</th>
                <th scope="col">Requirement</th>
                <th scope="col">Status</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {readiness.gates.map((gate) => (
                <tr key={gate.key}>
                  <td>{gate.label}</td>
                  <td>{gate.required ? "Required" : "Informational"}</td>
                  <td>
                    <Badge
                      tone={
                        gate.passed ? "success" : gate.required ? "danger" : "warning"
                      }
                    >
                      {gate.passed
                        ? "Passed"
                        : gate.required
                          ? "Blocking"
                          : "Not enabled"}
                    </Badge>
                  </td>
                  <td>{gate.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function formatRate(value: number | null) {
  return value === null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

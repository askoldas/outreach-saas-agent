import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";
import { rollbackWorkspaceIntelligenceAction } from "@/server/intelligence-rollout/actions";
import { enableWorkspaceControlledBetaAction } from "@/server/intelligence-rollout/actions";
import type { ControlledBetaReadiness } from "@/server/intelligence-rollout/readiness";

export function IntelligenceRolloutReadiness({
  readiness,
}: {
  readiness: ControlledBetaReadiness;
}) {
  const v2Configured =
    readiness.settings.campaignWorkflow === "v2" ||
    readiness.settings.profileVersion === "v2" ||
    readiness.settings.resultWriteMode !== "none";
  const controlledBetaActive =
    readiness.settings.campaignWorkflow === "v2" &&
    readiness.settings.profileVersion === "v2" &&
    readiness.settings.resultWriteMode === "canonical" &&
    !readiness.settings.shadowMode;

  return (
    <Card>
      <CardHeader
        title="Intelligence V2 rollout readiness"
        eyebrow="Controlled beta"
        action={
          <Badge tone={readiness.ready ? "success" : "warning"}>
            {readiness.ready ? "Ready for approval" : "Activation blocked"}
          </Badge>
        }
      />
      <div className={styles.cardBody}>
        <p>
          This assessment is informational and fail-closed. It cannot enable V2. Required
          gates must pass and controlled activation still requires an explicit operator
          decision.
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
            <caption>Controlled beta release gates</caption>
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

        {!controlledBetaActive ? (
          <form className={styles.stack} action={enableWorkspaceControlledBetaAction}>
            <h3>Enable controlled V2 beta</h3>
            <p>
              This workspace will create new Company Profiles and Campaigns with V2 and
              write canonical V2 results. The postponed benchmark requirement will be
              recorded as explicitly waived. If no prior run remains, the audit will mark
              fresh end-to-end validation as required. External-call kill switches and
              non-destructive rollback remain available.
            </p>
            <label className={form.field}>
              <span>Authorization reason</span>
              <textarea className={form.textarea} name="reason" required />
            </label>
            <label className={form.field}>
              <span>Type ENABLE V2 BETA to confirm</span>
              <input className={form.input} name="confirmation" required />
            </label>
            <Button type="submit" variant="primary">
              Enable controlled beta
            </Button>
          </form>
        ) : null}

        {v2Configured ? (
          <form className={styles.stack} action={rollbackWorkspaceIntelligenceAction}>
            <h3>Non-destructive workspace rollback</h3>
            <p>
              Stops new V2 profile and Campaign routing for this workspace. Existing V2
              campaigns and results remain readable; active runs are not silently deleted.
            </p>
            <label className={form.field}>
              <span>Reason</span>
              <textarea className={form.textarea} name="reason" required />
            </label>
            <label className={form.field}>
              <span>Type ROLLBACK to confirm</span>
              <input className={form.input} name="confirmation" required />
            </label>
            <Button type="submit" variant="danger">
              Rollback workspace to V1 routing
            </Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function formatRate(value: number | null) {
  return value === null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

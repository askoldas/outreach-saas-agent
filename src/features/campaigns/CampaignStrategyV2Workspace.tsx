import type { CampaignStrategyV2 } from "@/lib/intelligence/campaign-strategy-v2";
import { confirmCampaignStrategyV2Action } from "@/server/campaign-strategy-v2/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

export function CampaignStrategyV2Workspace({
  campaignId,
  draftId,
  strategy,
  message,
}: {
  campaignId: string;
  draftId: string | null;
  strategy: CampaignStrategyV2;
  message?: string;
}) {
  const confirmed = strategy.status === "confirmed";
  return (
    <div className={styles.twoColumn}>
      <div className={styles.stack}>
        {message ? <Badge tone="accent">{message}</Badge> : null}
        <Card>
          <CardHeader
            eyebrow={`Campaign Strategy V2 · ${strategy.status}`}
            title={strategy.strategySummary}
            action={
              <Badge tone={confirmed ? "success" : "blue"}>{strategy.status}</Badge>
            }
          />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            <Summary label="Objective" value={strategy.objective.label} />
            <Summary label="Geography" value={strategy.geography.displayName} />
            <Summary
              label="Target relationships"
              value={strategy.objective.targetRelationshipTypes.join(", ")}
            />
            <Summary
              label="Profile version"
              value={strategy.companyProfileVersionId.slice(0, 8)}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Buyer archetypes" eyebrow="Commercial roles" />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            {strategy.archetypes.map((archetype) => (
              <article key={archetype.id}>
                <Badge tone={archetype.priority === "priority" ? "success" : "neutral"}>
                  {archetype.priority}
                </Badge>
                <h3>{archetype.label}</h3>
                <p>{archetype.description}</p>
                <p className={styles.secondaryText}>{archetype.commercialRationale}</p>
              </article>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Qualification policy" eyebrow="No hidden holistic score" />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            {strategy.qualificationPolicy.factorDefinitions.map((factor) => (
              <Summary
                key={factor.factorKey}
                label={`${factor.label} · ${factor.weight}%`}
                value={factor.definition}
              />
            ))}
          </div>
        </Card>
      </div>
      <div className={styles.stack}>
        <Card>
          <CardHeader title="Discovery plan" eyebrow="Provider-neutral" />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            <Summary
              label="Primary provider capabilities"
              value={strategy.sourcePlan.primaryProviderTypes.join(", ")}
            />
            <Summary
              label="Verification capabilities"
              value={strategy.sourcePlan.verificationProviderTypes.join(", ")}
            />
            <Summary
              label="Maximum passes"
              value={String(strategy.stoppingPolicy.maximumDiscoveryPasses)}
            />
            <Summary
              label="Discovery segments"
              value={String(strategy.discoverySegments.length)}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={confirmed ? "Strategy confirmed" : "Confirm strategy"}
            eyebrow="Human review gate"
          />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            <p className={styles.secondaryText}>
              {confirmed
                ? "This immutable strategy version is ready for the V2 discovery workflow."
                : "Confirmation freezes the profile version, offering, objective, geography, archetypes, qualification policy, and discovery plan."}
            </p>
            {!confirmed && draftId ? (
              <form action={confirmCampaignStrategyV2Action}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="strategyDraftId" value={draftId} />
                <Button type="submit" variant="primary">
                  Confirm strategy
                </Button>
              </form>
            ) : null}
            <Button disabled title="Enabled with the V2 discovery provider packages">
              Start discovery
            </Button>
            <p className={styles.secondaryText}>
              V2 discovery remains intentionally gated until provider routing is
              implemented in WP-11 and later packages.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{label}</strong>
      <p>{value || "Not specified"}</p>
    </div>
  );
}

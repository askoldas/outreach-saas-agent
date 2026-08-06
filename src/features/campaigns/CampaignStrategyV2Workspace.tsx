import {
  canRetryCampaignStrategyV2Draft,
  type CampaignStrategyV2,
} from "@/lib/intelligence/campaign-strategy-v2";
import {
  confirmCampaignStrategyV2Action,
  retryCampaignStrategyV2Action,
} from "@/server/campaign-strategy-v2/actions";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";
import { CampaignStrategyV2Progress } from "./CampaignStrategyV2Progress";
import type { CampaignStrategyEnrichmentStatus } from "@/server/campaign-strategy-v2/repository";

export function CampaignStrategyV2Workspace({
  campaignId,
  draftId,
  strategy,
  enrichment,
  message,
}: {
  campaignId: string;
  draftId: string | null;
  strategy: CampaignStrategyV2;
  enrichment: CampaignStrategyEnrichmentStatus | null;
  message?: string;
}) {
  const confirmed = strategy.status === "confirmed";
  return (
    <div className={styles.twoColumn}>
      <div className={styles.stack}>
        {enrichment?.state === "running" ? <CampaignStrategyV2Progress /> : null}
        {message ? <Badge tone="accent">{message}</Badge> : null}
        {enrichment ? (
          <Card>
            <CardHeader
              eyebrow="Optional market intelligence"
              title={enrichmentTitle(enrichment.state)}
              action={
                <Badge tone={enrichmentTone(enrichment.state)}>
                  {enrichment.state.replaceAll("_", " ")}
                </Badge>
              }
            />
            <div className={`${styles.cardBody} ${styles.stack}`}>
              <p className={styles.secondaryText}>{enrichmentDescription(enrichment)}</p>
              {enrichment.applied || enrichment.rejected || enrichment.requiresUserReview ? (
                <Summary
                  label="Advisory operation results"
                  value={`${enrichment.applied} applied; ${enrichment.rejected} rejected; ${enrichment.requiresUserReview} require review; ${enrichment.omittedByBudget} omitted by budget`}
                />
              ) : null}
              {enrichment.state === "failed" && draftId ? (
                <form action={retryCampaignStrategyV2Action}>
                  <input type="hidden" name="campaignId" value={campaignId} />
                  <input type="hidden" name="strategyDraftId" value={draftId} />
                  <Button type="submit" variant="primary">Retry optional enrichment</Button>
                </form>
              ) : null}
            </div>
          </Card>
        ) : null}
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
              label="Selected offering"
              value={strategy.offeringReferences
                .map((item) => item.offeringId)
                .join(", ")}
            />
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
                <Summary
                  label="Required conditions"
                  value={conditions(archetype.requiredConditions)}
                />
                <Summary
                  label="Preferred conditions"
                  value={conditions(archetype.preferredConditions)}
                />
                <Summary
                  label="Exclusions"
                  value={conditions(archetype.exclusionConditions)}
                />
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
            <Summary
              label="Hard exclusions"
              value={strategy.qualificationPolicy.hardExclusionRules
                .map((rule) => rule.description)
                .join("; ")}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Assumptions and unresolved questions"
            eyebrow="Review before confirmation"
          />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            {strategy.assumptions.length ? (
              strategy.assumptions.map((assumption) => (
                <Summary
                  key={assumption.claimId}
                  label={assumption.epistemicStatus}
                  value={assumption.statement}
                />
              ))
            ) : (
              <p>No explicit market assumptions were proposed.</p>
            )}
            {strategy.unresolvedQuestions.map((question) => (
              <Summary
                key={question.questionKey}
                label={question.importance}
                value={question.question}
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
              label="Memory snapshot reference"
              value={strategy.memorySnapshotId}
            />
            <Summary
              label="Maximum passes"
              value={String(strategy.stoppingPolicy.maximumDiscoveryPasses)}
            />
            <Summary
              label="Discovery segments"
              value={String(strategy.discoverySegments.length)}
            />
            {strategy.discoverySegments.map((segment) => (
              <Summary
                key={segment.id}
                label={`${segment.label} terminology`}
                value={segment.businessCharacteristics.keywords.join(", ")}
              />
            ))}
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
            {confirmed ? (
              <ButtonLink href={`/campaigns/${campaignId}`} variant="primary">
                Go to campaign controls
              </ButtonLink>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CampaignStrategyV2Recovery({
  campaignId,
  draftId,
  state,
  message,
}: {
  campaignId: string;
  draftId: string;
  state: string;
  message?: string;
}) {
  const retryable = canRetryCampaignStrategyV2Draft(state);
  const building = state === "building";
  return (
    <div className={styles.stack}>
      {building ? <CampaignStrategyV2Progress /> : null}
      {message ? <Badge tone="accent">{message}</Badge> : null}
      <Card>
        <CardHeader
          eyebrow={`Campaign Strategy V2 · ${state}`}
          title={building ? "Strategy compilation is running" : "Strategy setup did not finish"}
          action={<Badge tone="neutral">{state}</Badge>}
        />
        <div className={`${styles.cardBody} ${styles.stack}`}>
          <p className={styles.secondaryText}>
            {building
              ? "The campaign and its frozen planning inputs are saved. Strategy compilation is running in the background; this page will update automatically."
              : "The campaign and its frozen planning inputs were saved, but the strategy compilation did not complete."}
          </p>
          {retryable ? (
            <form action={retryCampaignStrategyV2Action}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="strategyDraftId" value={draftId} />
              <Button type="submit" variant="primary">
                Retry strategy setup
              </Button>
            </form>
          ) : (
            <p>
              This draft cannot be retried from its current state. Create a new campaign
              or remove this incomplete campaign.
            </p>
          )}
        </div>
      </Card>
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

function conditions(items: Array<{ field: string; operator: string; value?: unknown }>) {
  return items
    .map((item) =>
      [item.field, item.operator.replaceAll("_", " "), formatConditionValue(item.value)]
        .filter(Boolean)
        .join(" "),
    )
    .join("; ");
}

function formatConditionValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null) return "";
  return String(value);
}

function enrichmentTitle(state: CampaignStrategyEnrichmentStatus["state"]) {
  if (state === "baseline_ready") return "Baseline strategy is ready";
  if (state === "running") return "Market enrichment is running";
  if (state === "partially_enriched") return "Strategy is partially enriched";
  if (state === "enriched") return "Strategy enrichment is complete";
  return "Optional enrichment failed";
}

function enrichmentDescription(status: CampaignStrategyEnrichmentStatus) {
  if (status.state === "baseline_ready") return "The deterministic baseline is valid and can be reviewed or confirmed while optional market intelligence is pending.";
  if (status.state === "running") return "The deterministic baseline remains available while bounded market observations and advisory operations are processed.";
  if (status.state === "enriched") return "All proposed advisory operations passed deterministic validation and were applied.";
  if (status.state === "partially_enriched") return "Safe operations were applied. Rejected, review-required, and budget-omitted operations did not alter the Strategy.";
  return status.message ?? "The deterministic baseline remains valid and can be confirmed without optional enrichment.";
}

function enrichmentTone(state: CampaignStrategyEnrichmentStatus["state"]) {
  if (state === "enriched") return "success" as const;
  if (state === "failed") return "warning" as const;
  if (state === "partially_enriched") return "accent" as const;
  return "blue" as const;
}

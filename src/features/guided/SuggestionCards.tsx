"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Offering } from "@/lib/company-profile/structured-profile";
import type { TargetSegment } from "@/lib/campaign-workflow/target-segments";
import type { CampaignPlanningOffering } from "@/lib/intelligence/campaign-strategy-v2";
import styles from "./SuggestionCards.module.css";

export function OfferingSuggestionCard({
  offering,
  primary,
  onSelect,
}: {
  offering: Offering;
  primary: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={styles.card} data-selected={primary}>
      <div className={styles.header}>
        <div>
          <h3>{offering.name}</h3>
          <p>{offering.shortDescription}</p>
        </div>
        <Badge tone={offering.status === "confirmed" ? "success" : "warning"}>
          {offering.status === "detected" ? "Inferred" : offering.status}
        </Badge>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Buyer organizations</dt>
          <dd>{offering.targetCustomerTypes.join(", ") || "Needs confirmation"}</dd>
        </div>
        <div>
          <dt>Likely decision makers</dt>
          <dd>
            {offering.buyerPersonas
              .flatMap((persona) => persona.exampleTitles)
              .join(", ") || "Not yet known"}
          </dd>
        </div>
      </dl>
      <details>
        <summary>View evidence and why suggested</summary>
        <p>
          {offering.valueProposition ||
            offering.sourceReferences[0]?.extractedText ||
            "Suggested from the structured Company Profile."}
        </p>
      </details>
      <Button type="button" variant={primary ? "primary" : "ghost"} onClick={onSelect}>
        {primary ? "Primary Campaign Offering" : "Set as primary"}
      </Button>
    </article>
  );
}

export function NativeOfferingSuggestionCard({
  offering,
  primary,
  onSelect,
}: {
  offering: CampaignPlanningOffering;
  primary: boolean;
  onSelect: () => void;
}) {
  const buyerArchetypes = offering.archetypes.filter(
    (archetype) =>
      archetype.status !== "user_rejected" &&
      archetype.status !== "superseded" &&
      archetype.priority !== "avoid",
  );
  return (
    <article className={styles.card} data-selected={primary}>
      <div className={styles.header}>
        <div>
          <h3>{offering.name}</h3>
          <p>{offering.shortDescription}</p>
        </div>
        <Badge tone={offering.confidence >= 0.7 ? "success" : "warning"}>
          {Math.round(offering.confidence * 100)}% profile confidence
        </Badge>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Reviewed buyer hypotheses</dt>
          <dd>
            {buyerArchetypes.map((archetype) => archetype.name).join(", ") ||
              "Needs campaign targeting"}
          </dd>
        </div>
        <div>
          <dt>Likely decision makers</dt>
          <dd>
            {Array.from(
              new Set(
                buyerArchetypes.flatMap((archetype) => archetype.likelyDecisionRoles),
              ),
            ).join(", ") || "To be researched"}
          </dd>
        </div>
      </dl>
      <details>
        <summary>View commercial logic</summary>
        <p>
          {offering.commercialMechanics.valueProposition.join(" ") ||
            offering.buyerLogic.whyBuy.join(" ") ||
            offering.shortDescription}
        </p>
      </details>
      <Button type="button" variant={primary ? "primary" : "ghost"} onClick={onSelect}>
        {primary ? "Primary Campaign Offering" : "Set as primary"}
      </Button>
    </article>
  );
}

export function TargetSuggestionCard({
  segment,
  selected,
  onToggle,
}: {
  segment: TargetSegment;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={styles.card} data-selected={selected}>
      <div className={styles.header}>
        <div>
          <h3>{segment.name}</h3>
          <p>{segment.summary}</p>
        </div>
        <div className={styles.badges}>
          <Badge tone={selected ? "success" : "neutral"}>
            {selected ? "Included" : "Excluded"}
          </Badge>
          <Badge tone={segment.confidence === "low" ? "warning" : "blue"}>
            {segment.confidence} confidence
          </Badge>
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Relationship</dt>
          <dd>{segment.relationshipType.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Organizations</dt>
          <dd>{segment.organizationTypes.join(", ")}</dd>
        </div>
        <div>
          <dt>Likely buyers</dt>
          <dd>{segment.likelyBuyerRoles.join(", ") || "Needs confirmation"}</dd>
        </div>
      </dl>
      <details>
        <summary>View why suggested and discovery feasibility</summary>
        <p>{segment.rationale}</p>
        <p>Discoverability: {segment.discoverability}</p>
        {segment.supportingEvidence.length ? (
          <ul>
            {segment.supportingEvidence.map((evidence) => (
              <li key={evidence}>{evidence}</li>
            ))}
          </ul>
        ) : null}
      </details>
      <Button type="button" variant={selected ? "ghost" : "primary"} onClick={onToggle}>
        {selected ? "Remove from Campaign" : "Include target"}
      </Button>
    </article>
  );
}

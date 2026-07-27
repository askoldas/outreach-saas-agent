"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignStrategyVersion } from "@/types/domain";
import { saveCampaignStrategyAction } from "@/server/campaign-strategy/actions";
import { generateCampaignStrategyAction } from "@/server/campaign-strategy/actions";
import { discoverCampaignLeadsAction } from "@/server/campaigns/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";

type ArrayKey = Exclude<
  keyof CampaignStrategyVersion,
  "id" | "version" | "status" | "targetGeography" | "targetCompanyCount"
>;

export function StrategyWorkspace({
  campaign,
  initialStrategy,
  startRevising = false,
}: Readonly<{
  campaign: Campaign;
  initialStrategy: CampaignStrategyVersion;
  startRevising?: boolean;
}>) {
  const router = useRouter();
  const [strategy, setStrategy] = useState(initialStrategy);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(
    initialStrategy.status !== "used" || (startRevising && campaign.status !== "running"),
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = initialStrategy.status === "used" && !revising;
  const activeRun = campaign.status === "running";

  function changeList(key: ArrayKey, value: string) {
    setStrategy((current) => ({ ...current, [key]: toList(value) }));
  }
  function refine() {
    const value = instruction.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        const result = await generateCampaignStrategyAction({
          campaignId: campaign.id,
          instruction: value,
        });
        setMessage(result.message);
        setInstruction("");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not generate Strategy",
        );
      }
    });
  }
  function update(partial: Partial<CampaignStrategyVersion>) {
    setStrategy((current) => ({ ...current, ...partial }));
    setMessage(
      "Structured strategy updated locally. Save to create an immutable version.",
    );
  }
  function startResearch() {
    startTransition(async () => {
      try {
        const result = await discoverCampaignLeadsAction(campaign.id);
        setMessage(
          `${result.message} Strategy version ${strategy.version} is now frozen.`,
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not start research");
      }
    });
  }

  const groups: Array<[string, Array<[ArrayKey, string]>]> = [
    [
      "Who Opptium will look for",
      [
        ["companyTypes", "Company types and segments"],
        ["industries", "Industries"],
        ["characteristics", "Characteristics"],
      ],
    ],
    [
      "Why these companies may be relevant",
      [
        ["relevanceReasons", "Likely needs and relevance"],
        ["opportunityAssumptions", "Opportunity assumptions"],
      ],
    ],
    [
      "How companies will be evaluated",
      [
        ["qualificationCriteria", "Required characteristics"],
        ["positiveSignals", "Positive signals"],
        ["exclusions", "Exclusions"],
      ],
    ],
    [
      "Who Opptium will try to contact",
      [
        ["contactRoles", "Relevant roles"],
        ["contactDepartments", "Departments"],
        ["acceptableContactRoutes", "Acceptable routes"],
      ],
    ],
    [
      "How Opptium will research",
      [
        ["searchLanguages", "Search languages"],
        ["sourceCategories", "Source categories"],
        ["limitations", "Expected limitations"],
      ],
    ],
  ];

  return (
    <form action={saveCampaignStrategyAction} className={styles.twoColumn}>
      <input type="hidden" name="campaignId" value={campaign.id} />
      <input type="hidden" name="searchTerms" value={strategy.searchTerms.join("\n")} />
      <input
        type="hidden"
        name="localizedTerms"
        value={strategy.localizedTerms.join("\n")}
      />
      <input
        type="hidden"
        name="refinementSummary"
        value={strategy.refinementSummary.join("\n")}
      />
      <div className={styles.stack}>
        <Card>
          <CardHeader
            title={`Strategy version ${initialStrategy.version}`}
            eyebrow={initialStrategy.status}
            action={
              <Badge tone={initialStrategy.status === "used" ? "blue" : "success"}>
                {initialStrategy.status}
              </Badge>
            }
          />
          <div className={styles.cardBody}>
            <div className={styles.filters}>
              <label className={form.field}>
                <span>Target geography</span>
                <input
                  className={form.input}
                  name="targetGeography"
                  disabled={locked}
                  value={strategy.targetGeography}
                  onChange={(e) => update({ targetGeography: e.target.value })}
                />
              </label>
              <label className={form.field}>
                <span>Target company count</span>
                <input
                  className={form.input}
                  name="targetCompanyCount"
                  type="number"
                  min="1"
                  disabled={locked}
                  value={strategy.targetCompanyCount}
                  onChange={(e) => update({ targetCompanyCount: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>
        </Card>
        {groups.map(([title, fields]) => (
          <Card key={title}>
            <CardHeader
              title={title}
              eyebrow={locked ? "Used for research · read-only" : "Structured strategy"}
            />
            <div className={`${styles.cardBody} ${styles.stack}`}>
              {fields.map(([key, label]) => (
                <label className={form.field} key={key}>
                  <span>{label}</span>
                  <textarea
                    className={form.textarea}
                    name={key}
                    disabled={locked}
                    value={(strategy[key] as string[]).join("\n")}
                    onChange={(e) => changeList(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className={styles.stack}>
        <Card>
          <CardHeader title="Refine strategy" eyebrow="Schema-validated AI" />
          <div className={`${styles.cardBody} ${styles.stack}`}>
            <p className={styles.secondaryText}>
              Refinement modifies structured fields. Saving creates a new immutable
              version. Pause an active run before changing its market. A paused run keeps
              its frozen strategy; stop it and start a new run to use the revised version.
            </p>
            <label className={form.field}>
              <span>Request a change</span>
              <textarea
                className={form.textarea}
                disabled={locked}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Exclude companies with fewer than 20 employees."
              />
            </label>
            <Button disabled={locked || pending} onClick={refine}>
              {pending ? "Generating…" : "Generate revised strategy"}
            </Button>
            {strategy.refinementSummary.length ? (
              <ul className={styles.feed}>
                {strategy.refinementSummary.map((item) => (
                  <li key={item}>
                    <strong>{item}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            {message ? <Badge tone="accent">{message}</Badge> : null}
            {locked ? (
              <Button
                variant="primary"
                disabled={activeRun}
                onClick={() => setRevising(true)}
              >
                Create revised strategy
              </Button>
            ) : (
              <>
                <Button type="submit" variant="primary" disabled={activeRun}>
                  Save as new version
                </Button>
                <Button
                  disabled={pending || initialStrategy.status === "used"}
                  onClick={startResearch}
                >
                  {pending ? "Starting research…" : "Start research with this version"}
                </Button>
              </>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Advanced details" eyebrow="Internal search plan" />
          <div className={styles.cardBody}>
            <p className={styles.secondaryText}>
              Search terms and localized terms are persisted but kept out of the primary
              strategy sections.
            </p>
            <ul className={styles.pillList}>
              {[...strategy.searchTerms, ...strategy.localizedTerms].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </form>
  );
}

function toList(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

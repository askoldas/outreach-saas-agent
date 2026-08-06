import type { Campaign, CampaignStrategyVersion } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

type ArrayKey = Exclude<
  keyof CampaignStrategyVersion,
  "id" | "version" | "status" | "targetGeography" | "targetCompanyCount"
>;

export function StrategyWorkspace({
  campaign,
  initialStrategy,
}: Readonly<{
  campaign: Campaign;
  initialStrategy: CampaignStrategyVersion;
  startRevising?: boolean;
}>) {
  const groups: Array<[string, Array<[ArrayKey, string]>]> = [
    [
      "Who Opptium looked for",
      [
        ["companyTypes", "Company types and segments"],
        ["industries", "Industries"],
        ["characteristics", "Characteristics"],
      ],
    ],
    [
      "Why those companies were considered",
      [
        ["relevanceReasons", "Likely needs and relevance"],
        ["opportunityAssumptions", "Opportunity assumptions"],
      ],
    ],
    [
      "How companies were evaluated",
      [
        ["qualificationCriteria", "Required characteristics"],
        ["positiveSignals", "Positive signals"],
        ["exclusions", "Exclusions"],
      ],
    ],
    [
      "Contact and research plan",
      [
        ["contactRoles", "Relevant roles"],
        ["contactDepartments", "Departments"],
        ["sourceCategories", "Source categories"],
        ["limitations", "Expected limitations"],
      ],
    ],
  ];

  return (
    <div className={styles.twoColumn}>
      <div className={styles.stack}>
        <Card>
          <CardHeader
            title={`Historical Strategy version ${initialStrategy.version}`}
            eyebrow={campaign.name}
            action={<Badge tone="warning">V1 read-only</Badge>}
          />
          <div className={styles.cardBody}>
            <p>
              This immutable strategy is retained for historical reports and exports. New
              edits and executions use Campaign Strategy V2.
            </p>
            <p>
              <strong>Target geography:</strong> {initialStrategy.targetGeography}
            </p>
            <p>
              <strong>Target company count:</strong> {initialStrategy.targetCompanyCount}
            </p>
          </div>
        </Card>
        {groups.map(([title, fields]) => (
          <Card key={title}>
            <CardHeader title={title} eyebrow="Historical V1 strategy" />
            <div className={`${styles.cardBody} ${styles.stack}`}>
              {fields.map(([key, label]) => (
                <section key={key}>
                  <strong>{label}</strong>
                  <List values={initialStrategy[key] as string[]} />
                </section>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className={styles.stack}>
        <Card>
          <CardHeader title="Search plan" eyebrow="Historical internal detail" />
          <div className={styles.cardBody}>
            <List
              values={[...initialStrategy.searchTerms, ...initialStrategy.localizedTerms]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Revision history" eyebrow="Historical summary" />
          <div className={styles.cardBody}>
            <List values={initialStrategy.refinementSummary} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function List({ values }: { values: string[] }) {
  return values.length ? (
    <ul className={styles.feed}>
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  ) : (
    <p className={styles.secondaryText}>No historical value recorded.</p>
  );
}

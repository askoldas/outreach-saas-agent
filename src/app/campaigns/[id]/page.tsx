import { notFound, redirect } from "next/navigation";
import { CampaignControls } from "@/features/campaigns/CampaignControls";
import { getCampaign } from "@/server/campaigns/repository";
import { listLeads } from "@/server/leads/repository";
import { getOffer } from "@/server/offers/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function CampaignDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const [campaign, leads] = await Promise.all([
    getCampaign(currentWorkspace.id, id),
    listLeads(currentWorkspace.id),
  ]);

  if (!campaign) {
    notFound();
  }

  const offer = await getOffer(currentWorkspace.id, campaign.offerId);
  const campaignLeads = leads.filter((lead) => lead.campaignId === campaign.id);
  const latestReport = campaign.latestDiscoveryReport;

  return (
    <div className={styles.grid}>
      <PageHeader
        title={campaign.name}
        description={`${campaign.objective} for ${offer?.name ?? "selected offer"} in ${campaign.geography}.`}
        actions={
          <div className={styles.filters}>
            <ButtonLink href={`/campaigns/${campaign.id}/edit`}>Edit</ButtonLink>
            <Badge tone={statusTone(campaign.status)}>
              {statusLabel(campaign.status)}
            </Badge>
          </div>
        }
      />

      <section className={styles.metricGrid}>
        <Card className={styles.metric}>
          <p>Progress</p>
          <h2>{campaign.progress}%</h2>
          <span>{campaign.lastActivity}</span>
        </Card>
        <Card className={styles.metric}>
          <p>Leads found</p>
          <h2>{campaign.leadCount}</h2>
          <span>
            {campaign.awaitingReview} awaiting review of {campaign.desiredLeadCount} target
          </span>
        </Card>
        <Card className={styles.metric}>
          <p>Language</p>
          <h2>{campaign.language}</h2>
          <span>Drafting remains external-review only</span>
        </Card>
        <Card className={styles.metric}>
          <p>Latest run</p>
          <h2>{latestReport ? latestReport.leadsSavedBeforeAiQualification.length : 0}</h2>
          <span>Saved before AI qualification</span>
        </Card>
      </section>

      <section className={styles.twoColumn}>
        <Card>
          <CardHeader title="Strategy summary" eyebrow="Reviewable plan" />
          <div className={styles.cardBody}>
            <Strategy title="Target segments" items={campaign.targetSegments} />
            <Strategy title="Industries" items={campaign.industryTerms} />
            <Strategy title="Search terminology" items={campaign.strategy.terms} />
            <Strategy
              title="Local-language terminology"
              items={campaign.strategy.localizedTerms}
            />
            <Strategy
              title="Expected source categories"
              items={campaign.strategy.sources}
            />
            <Strategy title="Qualification criteria" items={campaign.strategy.criteria} />
            <Strategy title="Exclusions" items={campaign.strategy.exclusions} />
            <Strategy title="Known limitations" items={campaign.strategy.limitations} />
          </div>
        </Card>
        <div className={styles.stack}>
          <Card>
            <CardHeader title="Leads by status" eyebrow="Campaign queue" />
            <div className={styles.cardBody}>
              <ul className={styles.pillList}>
                {["needs_review", "approved", "draft_ready", "researching"].map(
                  (status) => (
                    <li key={status}>
                      {statusLabel(status)}:{" "}
                      {
                        campaignLeads.filter((lead) => lead.status === status).length
                      }
                    </li>
                  ),
                )}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="Run activity and warnings" eyebrow="Diagnostics" />
            <div className={styles.cardBody}>
              <ul className={styles.feed}>
                {campaign.warnings.map((warning) => (
                  <li key={warning}>
                    <strong>Warning</strong>
                    <p>{warning}</p>
                  </li>
                ))}
                <li>
                  <strong>Last activity</strong>
                  <p>{campaign.lastActivity}</p>
                </li>
              </ul>
            </div>
          </Card>
          {latestReport ? (
            <Card>
              <CardHeader title="Latest discovery report" eyebrow="Provider run" />
              <div className={styles.cardBody}>
                <section className={styles.stack}>
                  <Strategy title="Queries executed" items={latestReport.queriesExecuted} />
                  <DiagnosticList
                    title="Raw Tavily results"
                    items={latestReport.rawTavilyResults.map(
                      (result) => `${result.title} (${result.query})`,
                    )}
                  />
                  <DiagnosticList
                    title="Duplicate domains removed"
                    items={latestReport.duplicateResults.map(
                      (result) => `${result.title}: ${result.reason}`,
                    )}
                  />
                  <DiagnosticList
                    title="Rejected URLs"
                    items={latestReport.rejectedResults.map(
                      (result) => `${result.title}: ${result.reason}`,
                    )}
                  />
                  <DiagnosticList
                    title="Skipped after target reached"
                    items={(latestReport.targetSkippedResults ?? []).map(
                      (result) => `${result.title}: ${result.reason}`,
                    )}
                  />
                  <DiagnosticList
                    title="Saved before AI"
                    items={latestReport.leadsSavedBeforeAiQualification}
                  />
                  <DiagnosticList
                    title="AI qualification failures"
                    items={latestReport.aiQualificationFailures.map(
                      (failure) => `${failure.leadId}: ${failure.error}`,
                    )}
                  />
                  <DiagnosticList
                    title="Contact discovery"
                    items={latestReport.contactDiscovery.map((item) => {
                      const fetched = item.attempts.filter(
                        (attempt) => attempt.status === "fetched",
                      ).length;
                      const failed = item.attempts.filter(
                        (attempt) => attempt.status === "failed",
                      ).length;

                      return `${item.leadId}: ${item.routesFound} route${item.routesFound === 1 ? "" : "s"}, ${fetched} fetched, ${failed} failed`;
                    })}
                  />
                </section>
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Controls" eyebrow="Workspace status" />
            <div className={styles.cardBody}>
              <CampaignControls
                campaignId={campaign.id}
                desiredLeadCount={campaign.desiredLeadCount}
                initialLeadCount={campaign.leadCount}
                status={campaign.status}
              />
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Strategy({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <section className={styles.stack}>
      <h2 className={styles.primaryText}>{title}</h2>
      <ul className={styles.pillList}>
        {items.length === 0 ? <li>No values yet</li> : null}
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function DiagnosticList({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <section className={styles.stack}>
      <h2 className={styles.primaryText}>{title}</h2>
      <ul className={styles.feed}>
        {items.length === 0 ? (
          <li>
            <strong>None</strong>
            <p>No entries recorded for this run.</p>
          </li>
        ) : null}
        {items.slice(0, 12).map((item, index) => (
          <li key={`${title}-${index}-${item}`}>
            <strong>{item}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

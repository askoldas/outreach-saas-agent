import { notFound, redirect } from "next/navigation";
import { LeadActions } from "@/features/leads/LeadActions";
import { getCampaign } from "@/server/campaigns/repository";
import { getLead } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { confidenceTone, scoreTone, statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function LeadDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const lead = await getLead(currentWorkspace.id, id);

  if (!lead) {
    notFound();
  }

  const campaign = lead.campaignId
    ? await getCampaign(currentWorkspace.id, lead.campaignId)
    : null;

  return (
    <div className={styles.grid}>
      <PageHeader
        title={lead.company}
        description={lead.description}
        actions={<Badge tone={statusTone(lead.status)}>{statusLabel(lead.status)}</Badge>}
      />

      <section className={styles.metricGrid}>
        <Card className={styles.metric}>
          <p>Fit score</p>
          <h2>{lead.fitScore}</h2>
          <span>{statusLabel(lead.confidence)} evidence confidence</span>
        </Card>
        <Card className={styles.metric}>
          <p>Location</p>
          <h2>{lead.country}</h2>
          <span>{lead.city}</span>
        </Card>
        <Card className={styles.metric}>
          <p>Company type</p>
          <h2>{lead.companyType}</h2>
          <span>{lead.estimatedSize}</span>
        </Card>
        <Card className={styles.metric}>
          <p>Contactability</p>
          <h2>{statusLabel(lead.contactability)}</h2>
          <span>Mock public routes only</span>
        </Card>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.stack}>
          <Card>
            <CardHeader
              title="Company summary"
              eyebrow={campaign?.name ?? "Unknown campaign"}
            />
            <div className={styles.cardBody}>
              <p>
                <strong>Website:</strong> {lead.website}
              </p>
              <p>
                <strong>Industry:</strong> {lead.industry}
              </p>
              <p>{lead.description}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Qualification" eyebrow="Reusable score dimensions" />
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {lead.qualification.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>
                        <Badge tone={scoreTone(item.score)}>{item.score}</Badge>
                      </td>
                      <td>
                        <Badge tone={confidenceTone(item.confidence)}>
                          {statusLabel(item.confidence)}
                        </Badge>
                      </td>
                      <td>{item.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Evidence" eyebrow="Facts and inferences are distinct" />
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Claim</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Retrieved</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {lead.evidence.map((claim) => (
                    <tr key={claim.id}>
                      <td>{claim.text}</td>
                      <td>
                        <Badge tone={statusTone(claim.kind)}>
                          {statusLabel(claim.kind)}
                        </Badge>
                      </td>
                      <td>
                        <span className={styles.primaryText}>{claim.sourceLabel}</span>
                        <span className={styles.secondaryText}>{claim.sourceType}</span>
                      </td>
                      <td>{claim.retrievedAt}</td>
                      <td>
                        <Badge tone={confidenceTone(claim.confidence)}>
                          {statusLabel(claim.confidence)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className={styles.stack}>
          <Card>
            <CardHeader
              title="Why this company may fit"
              eyebrow="Qualification summary"
            />
            <div className={styles.cardBody}>
              <p>{lead.summary}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Contacts" eyebrow="Not presented as verified delivery" />
            <div className={styles.cardBody}>
              <ul className={styles.feed}>
                {lead.contacts.map((contact) => (
                  <li key={`${contact.type}-${contact.value}`}>
                    <strong>
                      {contact.type}: {contact.value}
                    </strong>
                    <p>{contact.suggestedRole}</p>
                    <Badge
                      tone={
                        contact.verification === "source_confirmed"
                          ? "success"
                          : "warning"
                      }
                    >
                      {statusLabel(contact.verification)}
                    </Badge>
                    <span>{contact.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="Review actions" eyebrow="Workspace status" />
            <div className={styles.cardBody}>
              <LeadActions leadId={lead.id} status={lead.status} />
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

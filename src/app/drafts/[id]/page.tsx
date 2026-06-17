import { notFound } from "next/navigation";
import { drafts, getCampaign, getDraft, getLead } from "@/data/mock/prospecting";
import { DraftEditor } from "@/features/drafts/DraftEditor";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function DraftDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const draft = getDraft(id);

  if (!draft) {
    notFound();
  }

  const lead = getLead(draft.leadId);
  const campaign = getCampaign(draft.campaignId);

  return (
    <div className={styles.grid}>
      <PageHeader
        title={draft.subject}
        description={`External compose draft for ${lead?.company ?? "selected lead"}. Opening mail does not mark this as sent.`}
        actions={
          <Badge tone={statusTone(draft.status)}>{statusLabel(draft.status)}</Badge>
        }
      />
      <section className={styles.twoColumn}>
        <Card>
          <CardHeader title="Draft editor" eyebrow={draft.language} />
          <div className={styles.cardBody}>
            <DraftEditor draft={draft} />
          </div>
        </Card>
        <div className={styles.stack}>
          <Card>
            <CardHeader title="Recipient information" eyebrow="Public route" />
            <div className={styles.cardBody}>
              <p>
                <strong>Lead:</strong> {lead?.company}
              </p>
              <p>
                <strong>Route:</strong> {draft.recipientRoute}
              </p>
              <p>
                <strong>Campaign:</strong> {campaign?.name}
              </p>
              <p>
                <strong>Variant:</strong> {statusLabel(draft.variant)}
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Selected seller claims" eyebrow="Approved offer inputs" />
            <div className={styles.cardBody}>
              <ul className={styles.pillList}>
                {draft.sellerClaims.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="Prospect evidence used" eyebrow="Internal grounding" />
            <div className={styles.cardBody}>
              <ul className={styles.pillList}>
                {draft.evidenceUsed.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>
          <Card>
            <CardHeader title="Personalization warnings" eyebrow="Do not overstate" />
            <div className={styles.cardBody}>
              <ul className={styles.feed}>
                {draft.warnings.map((warning) => (
                  <li key={warning}>
                    <strong>Warning</strong>
                    <p>{warning}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

export function generateStaticParams() {
  return drafts.map((draft) => ({ id: draft.id }));
}

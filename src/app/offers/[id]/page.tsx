import { notFound } from "next/navigation";
import { getOffer } from "@/data/mock/prospecting";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function OfferDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const offer = getOffer(id);

  if (!offer) {
    notFound();
  }

  return (
    <div className={styles.grid}>
      <PageHeader
        title={offer.name}
        description={offer.summary}
        actions={
          <Badge tone={statusTone(offer.status)}>{statusLabel(offer.status)}</Badge>
        }
      />

      <section className={styles.twoColumn}>
        <Card>
          <CardHeader title="User-approved information" eyebrow={offer.approvedVersion} />
          <div className={styles.cardBody}>
            <Section title="Problems solved" items={offer.problems} />
            <Section title="Capabilities" items={offer.capabilities} />
            <Section title="Customer value" items={offer.customerValue} />
            <Section title="Likely buyer types" items={offer.buyerTypes} />
            <Section title="Differentiators" items={offer.differentiators} />
          </div>
        </Card>

        <div className={styles.stack}>
          <Card>
            <CardHeader title="AI-proposed information" eyebrow="Needs review" />
            <div className={styles.cardBody}>
              <ul className={styles.pillList}>
                {offer.aiProposals.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Missing information" eyebrow="Open questions" />
            <div className={styles.cardBody}>
              <ul className={styles.pillList}>
                {offer.missingInfo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Limitations and keywords" eyebrow="Campaign inputs" />
            <div className={styles.cardBody}>
              <Section title="Limitations" items={offer.limitations} />
              <Section title="Keywords" items={offer.keywords} />
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Section({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <section className={styles.stack}>
      <h2 className={styles.primaryText}>{title}</h2>
      <ul className={styles.pillList}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

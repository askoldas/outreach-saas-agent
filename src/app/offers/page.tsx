import Link from "next/link";
import { offers } from "@/data/mock/prospecting";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OffersPage() {
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Offers"
        description="Manage reusable product and service profiles before campaigns use them."
        actions={
          <ButtonLink href="/offers/new" variant="primary">
            Add offer
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader title="Offer library" eyebrow="Seller knowledge" />
        <div className={styles.cardBody}>
          <div className={styles.filters}>
            <label className={form.field} htmlFor="offer-search">
              <span>Search offers</span>
              <input
                className={form.input}
                id="offer-search"
                placeholder="Search by name or buyer type"
              />
            </label>
            <label className={form.field} htmlFor="offer-status">
              <span>Status</span>
              <select className={form.select} id="offer-status" defaultValue="all">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Approved version</th>
                  <th>Campaigns</th>
                  <th>Last updated</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <Link className={styles.primaryText} href={`/offers/${offer.id}`}>
                        {offer.name}
                      </Link>
                      <span className={styles.secondaryText}>{offer.summary}</span>
                    </td>
                    <td>{statusLabel(offer.type)}</td>
                    <td>
                      <Badge tone={statusTone(offer.status)}>
                        {statusLabel(offer.status)}
                      </Badge>
                    </td>
                    <td>{offer.approvedVersion}</td>
                    <td>{offer.campaignCount}</td>
                    <td>{offer.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

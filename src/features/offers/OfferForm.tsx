import { createOfferAction } from "@/server/offers/actions";
import form from "@/components/ui/FormControls.module.css";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

const fields = [
  ["offer-name", "Offer name", "Invoice operations automation"],
  ["summary", "Summary", "What the product or service does and who it helps"],
  ["problems", "Customer problems solved", "Manual approvals, slow supplier handoffs"],
  [
    "capabilities",
    "Main capabilities",
    "Approval routing, inspection reports, service planning",
  ],
  ["value", "Customer value", "Reduce delays, clarify ownership, improve handoffs"],
  [
    "buyers",
    "Likely buyer types",
    "Operations leaders, finance directors, procurement teams",
  ],
  [
    "differentiators",
    "Differentiators",
    "Fast setup, documented process, specialist experience",
  ],
  ["limitations", "Limitations or exclusions", "Where this offer is not a fit"],
  ["keywords", "Keywords", "Search terms and synonyms for later campaign planning"],
] as const;

export function OfferForm({ error }: Readonly<{ error?: string }>) {
  return (
    <Card>
      <CardHeader title="Offer profile" eyebrow="Workspace record" />
      <form className={styles.cardBody} action={createOfferAction}>
        <div className={styles.stack}>
          {error ? <p className={styles.secondaryText}>{error}</p> : null}
          <div className={form.field}>
            <label htmlFor="offer-type">Offer type</label>
            <select
              className={form.select}
              id="offer-type"
              name="offerType"
              defaultValue="service"
            >
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="software">Software</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="distribution">Distribution</option>
              <option value="partnership">Partnership</option>
            </select>
            <span>
              This shapes the interface only; it is not sector-specific classification.
            </span>
          </div>

          {fields.map(([id, label, placeholder]) => (
            <div className={form.field} key={id}>
              <label htmlFor={id}>{label}</label>
              {id === "offer-name" ? (
                <input
                  className={form.input}
                  id={id}
                  name={id}
                  placeholder={placeholder}
                />
              ) : (
                <textarea
                  className={form.textarea}
                  id={id}
                  name={id}
                  placeholder={placeholder}
                />
              )}
            </div>
          ))}

          <Button variant="primary" type="submit">
            Save offer
          </Button>
        </div>
      </form>
    </Card>
  );
}

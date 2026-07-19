import { createCampaignAction } from "@/server/campaigns/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";
export function CampaignBriefForm({ error }: { error?: string }) {
  return (
    <Card>
      <CardHeader
        title="Describe the companies you want to find and why they may be relevant."
        eyebrow="Campaign brief"
      />
      <form
        action={createCampaignAction}
        className={`${styles.cardBody} ${styles.stack}`}
      >
        <input type="hidden" name="objective" value="Natural-language campaign brief" />
        <input type="hidden" name="language" value="English" />
        <input type="hidden" name="terms" value="Generated from campaign brief" />
        <input
          type="hidden"
          name="sourceCategories"
          value="Company websites, public business directories, trade associations"
        />
        <input
          type="hidden"
          name="qualificationCriteria"
          value="Business activity fit, likely need, company-type fit, geography, commercial plausibility, exclusions"
        />
        {error ? <p>{error}</p> : null}
        <label className={form.field}>
          <span>Campaign name</span>
          <input
            className={form.input}
            name="name"
            required
            placeholder="Northern Europe operations partners"
          />
        </label>
        <label className={form.field}>
          <span>Campaign brief</span>
          <textarea
            className={form.textarea}
            name="targetSegments"
            required
            placeholder="Manufacturers that may need our maintenance services."
          />
        </label>
        <div className={styles.filters}>
          <label className={form.field}>
            <span>Country or region (optional)</span>
            <input
              className={form.input}
              name="geography"
              defaultValue="Any relevant market"
            />
          </label>
          <label className={form.field}>
            <span>Desired companies</span>
            <input
              className={form.input}
              name="desiredLeadCount"
              type="number"
              min="1"
              defaultValue="25"
            />
          </label>
        </div>
        <fieldset className={form.field}>
          <legend>Campaign focus</legend>
          <label>
            <input type="radio" name="campaignFocus" defaultChecked value="profile" /> Use
            complete Company Profile
          </label>
          <label>
            <input type="radio" name="campaignFocus" value="specific" /> Focus on a
            specific product, service, capability, or proposition
          </label>
        </fieldset>
        <p className={styles.secondaryText}>
          The initial structured strategy is created from this brief for review. You can
          request schema-validated AI revisions before starting research.
        </p>
        <div className={styles.filters}>
          <Button>Save as draft</Button>
          <Button variant="primary" type="submit">
            Create campaign strategy
          </Button>
        </div>
      </form>
    </Card>
  );
}

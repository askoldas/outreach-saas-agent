import type { CompanyProfile } from "@/types/domain";
import { updateCompanyWebsiteAction } from "@/server/company-profile/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";

export function CompanyWebsiteSettings({
  profile,
}: Readonly<{ profile: CompanyProfile }>) {
  return (
    <Card>
      <CardHeader title="Company website" eyebrow="Website analysis source" />
      <form
        action={updateCompanyWebsiteAction}
        className={`${styles.cardBody} ${styles.stack}`}
      >
        <label className={form.field}>
          <span>Website URL</span>
          <input
            className={form.input}
            name="website"
            defaultValue={profile.website ?? ""}
            inputMode="url"
            placeholder="https://example.com"
            required
          />
          <span>
            Website analysis uses this URL. Changing “Sources and materials” does not
            change the company website.
          </span>
        </label>
        <div>
          <Button variant="primary" type="submit">
            Save website URL
          </Button>
        </div>
      </form>
    </Card>
  );
}

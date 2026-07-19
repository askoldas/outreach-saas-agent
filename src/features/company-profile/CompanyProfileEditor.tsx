import type { CompanyProfile } from "@/types/domain";
import { saveCompanyProfileAction } from "@/server/company-profile/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";

export function CompanyProfileEditor({ profile }: Readonly<{ profile: CompanyProfile }>) {
  const fields: Array<[keyof CompanyProfile, string]> = [
    ["productsAndServices", "Products and services"],
    ["capabilities", "Capabilities"],
    ["customerTypes", "Customer types and industries"],
    ["differentiators", "Differentiators"],
    ["proofPoints", "Proof and case studies"],
    ["marketsAndLanguages", "Markets and languages"],
    ["claims", "Usable claims"],
    ["limitations", "Limitations"],
    ["sources", "Sources and materials"],
  ];
  return (
    <Card>
      <CardHeader
        title="Create a new profile version"
        eyebrow="Persisted workspace knowledge"
      />
      <form
        action={saveCompanyProfileAction}
        className={`${styles.cardBody} ${styles.stack}`}
      >
        <label className={form.field}>
          <span>Company name</span>
          <input
            className={form.input}
            name="companyName"
            defaultValue={profile.companyName}
            required
          />
        </label>
        <label className={form.field}>
          <span>Website</span>
          <input
            className={form.input}
            name="website"
            defaultValue={profile.website ?? ""}
            type="url"
          />
        </label>
        <label className={form.field}>
          <span>Business summary</span>
          <textarea
            className={form.textarea}
            name="summary"
            defaultValue={profile.summary}
          />
        </label>
        {fields.map(([key, label]) => (
          <label className={form.field} key={key}>
            <span>{label}</span>
            <textarea
              className={form.textarea}
              name={key}
              defaultValue={(profile[key] as string[]).join("\n")}
            />
          </label>
        ))}
        <input type="hidden" name="warnings" value={profile.warnings.join("\n")} />
        <Button variant="primary" type="submit">
          Save new version
        </Button>
      </form>
    </Card>
  );
}

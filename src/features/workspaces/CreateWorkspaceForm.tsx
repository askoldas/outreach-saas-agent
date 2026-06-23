import { createWorkspaceAction } from "@/server/workspaces/actions";
import form from "@/components/ui/FormControls.module.css";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

export function CreateWorkspaceForm({
  error,
}: Readonly<{
  error?: string;
}>) {
  return (
    <Card>
      <CardHeader title="Create your first workspace" eyebrow="Tenant boundary" />
      <form action={createWorkspaceAction} className={styles.cardBody}>
        <div className={styles.stack}>
          {error ? <p className={form.errorText}>{error}</p> : null}
          <label className={form.field} htmlFor="name">
            <span>Workspace name</span>
            <input
              className={form.input}
              id="name"
              maxLength={120}
              minLength={2}
              name="name"
              placeholder="Northstar Components"
              required
            />
          </label>
          <label className={form.field} htmlFor="websiteUrl">
            <span>Website URL</span>
            <input
              className={form.input}
              id="websiteUrl"
              name="websiteUrl"
              placeholder="https://example.com"
              type="url"
            />
          </label>
          <Button type="submit" variant="primary">
            Create workspace
          </Button>
        </div>
      </form>
    </Card>
  );
}

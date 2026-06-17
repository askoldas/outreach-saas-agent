import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function SettingsPage() {
  const { currentWorkspace, workspaces } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Settings"
        description="Workspace settings are now loaded through Supabase RLS. Team and billing settings remain future work."
      />
      <Card>
        <CardHeader
          title={currentWorkspace.name}
          eyebrow="Current workspace"
          action={<Badge tone="success">{currentWorkspace.status}</Badge>}
        />
        <div className={styles.cardBody}>
          <p>
            <strong>Slug:</strong> {currentWorkspace.slug}
          </p>
          <p>
            <strong>Website:</strong> {currentWorkspace.websiteUrl ?? "Not set"}
          </p>
          <p>
            <strong>Locale:</strong> {currentWorkspace.defaultLocale}
          </p>
          <p>
            <strong>Accessible workspaces:</strong> {workspaces.length}
          </p>
        </div>
      </Card>
    </div>
  );
}

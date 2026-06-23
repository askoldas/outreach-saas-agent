import { redirect } from "next/navigation";
import { CreateWorkspaceForm } from "@/features/workspaces/CreateWorkspaceForm";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import styles from "@/features/shared/Feature.module.css";
import { PageHeader } from "@/components/ui/PageHeader";

type SearchParams = {
  error?: string;
};

export default async function WorkspaceOnboardingPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const { workspaces } = await getWorkspaceContext();

  if (workspaces.length > 0) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Set up your workspace"
        description="A workspace is the tenant boundary for offers, campaigns, leads, evidence, and drafts."
      />
      <CreateWorkspaceForm error={params.error} />
    </div>
  );
}

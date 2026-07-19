import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/user";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CompanyProfileEditor } from "@/features/company-profile/CompanyProfileEditor";
import { analyzeCompanyProfileAction } from "@/server/company-profile/actions";
import styles from "@/features/shared/Feature.module.css";
import { getCampaignResearchProgress } from "@/server/research/repository";
import { RunProgressPanel } from "@/features/progress/RunProgressPanel";

export default async function CompanyProfilePage() {
  if (!(await getCurrentUser())) redirect("/auth/sign-in?next=/company-profile");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!profile) {
    throw new Error(
      "Company Profile is missing. Apply the ordered profile migrations before using this workspace.",
    );
  }
  const analysisProgress = await getCampaignResearchProgress({
    campaignId: "company-profile",
    workspaceId: currentWorkspace.id,
  });
  const sections = [
    ["Overview", [profile.summary]],
    ["Products and services", profile.productsAndServices],
    ["Capabilities", profile.capabilities],
    ["Customer types and industries", profile.customerTypes],
    ["Differentiators", profile.differentiators],
    ["Proof and case studies", profile.proofPoints],
    ["Markets and languages", profile.marketsAndLanguages],
    [
      "Claims and limitations",
      [...profile.claims, ...profile.limitations.map((x) => `Limitation: ${x}`)],
    ],
    ["Sources and materials", profile.sources],
  ] as const;
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Company Profile"
        description="Reusable seller knowledge for campaign strategy and evidence-grounded outreach."
        actions={
          <>
            <form action={analyzeCompanyProfileAction}>
              <Button type="submit" disabled={!profile.website}>
                Analyze website
              </Button>
            </form>
            <Button variant="primary">Add information</Button>
          </>
        }
      />
      <RunProgressPanel
        key={analysisProgress?.runId ?? "no-analysis"}
        endpoint="/api/company-profile/analysis-progress"
        initialProgress={analysisProgress}
        title="Website analysis"
      />
      <Card>
        <CardHeader
          title={profile.companyName}
          eyebrow={profile.website ?? "Website not supplied"}
          action={<Badge tone="warning">Persisted · version {profile.version}</Badge>}
        />
        <div className={styles.cardBody}>
          <p className={styles.secondaryText}>
            Last analysis: {profile.lastAnalyzed ?? "Not analysed"}. Missing information
            is non-blocking.
          </p>
        </div>
      </Card>
      {profile.warnings.length ? (
        <Card>
          <CardHeader title="Readiness suggestions" eyebrow="Non-blocking" />
          <div className={styles.cardBody}>
            <ul className={styles.feed}>
              {profile.warnings.map((warning) => (
                <li key={warning}>
                  <strong>{warning}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}
      <section className={styles.twoColumn}>
        {sections.map(([title, values]) => (
          <Card key={title}>
            <CardHeader
              title={title}
              action={<Button variant="ghost">Edit section</Button>}
            />
            <div className={styles.cardBody}>
              <ul className={styles.pillList}>
                {values.length ? (
                  values.map((value) => <li key={value}>{value}</li>)
                ) : (
                  <li>No information yet</li>
                )}
              </ul>
            </div>
          </Card>
        ))}
      </section>
      <CompanyProfileEditor profile={profile} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/user";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CompanyProfileWorkspace } from "@/features/company-profile/CompanyProfileWorkspace";
import { CompanyWebsiteSettings } from "@/features/company-profile/CompanyWebsiteSettings";
import { analyzeCompanyProfileAction } from "@/server/company-profile/actions";
import styles from "@/features/shared/Feature.module.css";
import { getCampaignResearchProgress } from "@/server/research/repository";
import { RunProgressPanel } from "@/features/progress/RunProgressPanel";
import { CompanyGuidedSetup } from "@/features/company-profile/CompanyGuidedSetup";
import { ContextualAiDrawer } from "@/features/guided/ContextualAiDrawer";

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const query = await searchParams;
  if (!(await getCurrentUser())) redirect("/login?next=/company-profile");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  const analysisProgress = await getCampaignResearchProgress({
    campaignId: "company-profile",
    workspaceId: currentWorkspace.id,
  });
  const pendingQuestions = profile.reviewQuestions.filter(
    (question) => question.status === "unanswered",
  ).length;

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Your Company"
        description="Profile draft generated from your website. Review important commercial details before starting a campaign."
        actions={
          <>
            {profile.structuredProfile?.offerings.length ? (
              <ButtonLink variant="primary" href="/campaigns/new">
                Create campaign
              </ButtonLink>
            ) : null}
            <form action={analyzeCompanyProfileAction}>
              <Button type="submit" disabled={!profile.website}>
                {profile.structuredProfile
                  ? "Improve profile structure"
                  : "Analyse website"}
              </Button>
            </form>
            {pendingQuestions ? (
              <ButtonLink variant="primary" href="#review-questions">
                Review {pendingQuestions} questions
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <CompanyWebsiteSettings profile={profile} />
      {query.message === "company-website-updated" ? (
        <Badge tone="success">
          Company website updated. Future analysis runs will use the new URL.
        </Badge>
      ) : null}
      {query.error ? <Badge tone="danger">{errorMessage(query.error)}</Badge> : null}
      <RunProgressPanel
        key={analysisProgress?.runId ?? "no-analysis"}
        endpoint="/api/company-profile/analysis-progress"
        initialProgress={analysisProgress}
        title="Website analysis"
      />
      <ContextualAiDrawer
        context={`Company — ${profile.companyName}`}
        scope="company"
        entityId={profile.id ?? "current"}
        baseVersion={profile.version}
        actions={[
          "Improve the overview",
          "Add a missing offering",
          "Reclassify a capability",
          "Suggest missing customer types",
        ]}
      />
      <CompanyGuidedSetup profile={profile} />
      <CompanyProfileWorkspace profile={profile} />
    </div>
  );
}

function errorMessage(error: string) {
  const messages: Record<string, string> = {
    "invalid-website-url": "Enter a valid public HTTP or HTTPS website URL.",
    "website-required": "Save a website URL before starting website analysis.",
    "company-profile-not-found":
      "The workspace profile could not be initialized. Refresh and try again.",
    "question-answer-required": "Choose or enter an answer before continuing.",
    "structured-profile-required":
      "Analyse the website to create a structured profile first.",
  };
  return messages[error] ?? "The profile could not be updated.";
}

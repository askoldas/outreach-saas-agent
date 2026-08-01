import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/user";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CompanyWebsiteSettings } from "@/features/company-profile/CompanyWebsiteSettings";
import styles from "@/features/shared/Feature.module.css";
import { getCampaignResearchProgress } from "@/server/research/repository";
import { RunProgressPanel } from "@/features/progress/RunProgressPanel";
import { getCurrentCompanyProfileV3Review } from "@/server/company-profile-v3/repository";
import { createCompanyProfileV3DraftAction } from "@/server/company-profile-v3/actions";
import { CompanyProfileV3Workspace } from "@/features/company-profile/CompanyProfileV3Workspace";
import { Card, CardHeader } from "@/components/ui/Card";

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const query = await searchParams;
  if (!(await getCurrentUser())) redirect("/login?next=/company-profile");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const [profile, analysisProgress] = await Promise.all([
    getCurrentCompanyProfileV3Review(currentWorkspace.id),
    getCampaignResearchProgress({
      campaignId: "company-profile",
      workspaceId: currentWorkspace.id,
    }),
  ]);
  const pendingQuestions = profile
    ? profile.questions.filter((question) => question.status === "pending").length
    : 0;
  const reviewable = Boolean(
    profile && ["needs_input", "ready_for_review", "approved"].includes(profile.state),
  );

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Your Company"
        description="Build and review the commercial intelligence used by every new campaign."
        actions={
          <>
            {profile?.state === "approved" ? (
              <ButtonLink variant="primary" href="/campaigns/new">
                Create campaign
              </ButtonLink>
            ) : null}
            {reviewable && currentWorkspace.websiteUrl ? (
              <form action={createCompanyProfileV3DraftAction}>
                <Button type="submit">Improve Company Intelligence</Button>
              </form>
            ) : null}
            {pendingQuestions ? (
              <ButtonLink variant="primary" href="#profile-v3-review">
                Review {pendingQuestions} questions
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <CompanyWebsiteSettings website={currentWorkspace.websiteUrl} />
      {query.message === "company-website-updated" ? (
        <Badge tone="success">
          Company website updated. Future analysis runs will use the new URL.
        </Badge>
      ) : null}
      {query.message === "v3-profile-published" ? (
        <Badge tone="success">
          Company Intelligence V3 was published as an immutable profile version.
        </Badge>
      ) : null}
      {query.message === "v3-analysis-started" ? (
        <Badge tone="success">
          Native Company Intelligence analysis started from the official website.
        </Badge>
      ) : null}
      {query.message === "v3-core-updated" ? (
        <Badge tone="success">Reviewed Company Intelligence fields were saved.</Badge>
      ) : null}
      {query.message === "v3-question-answered" ? (
        <Badge tone="success">The clarification answer was saved.</Badge>
      ) : null}
      {query.message === "v3-question-skipped" ? (
        <Badge tone="success">The optional clarification question was skipped.</Badge>
      ) : null}
      {query.error ? <Badge tone="danger">{errorMessage(query.error)}</Badge> : null}
      <RunProgressPanel
        key={analysisProgress?.runId ?? "no-analysis"}
        endpoint="/api/company-profile/analysis-progress"
        initialProgress={analysisProgress}
        title="Website analysis"
      />
      {profile && reviewable ? (
        <CompanyProfileV3Workspace review={profile} />
      ) : (
        <Card>
          <CardHeader
            title={
              profile?.state === "failed"
                ? "Retry Company Intelligence analysis"
                : profile?.state === "building"
                  ? "Building Company Intelligence"
                  : "Create Company Intelligence"
            }
            eyebrow="Build the native commercial model from the official website"
            action={
              profile?.state !== "building" ? (
                <form action={createCompanyProfileV3DraftAction}>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!currentWorkspace.websiteUrl}
                  >
                    {profile?.state === "failed"
                      ? "Retry Company Intelligence"
                      : "Create Company Intelligence"}
                  </Button>
                </form>
              ) : null
            }
          />
          <div className={styles.cardBody}>
            <p>
              Opptium collects first-party evidence from the saved company website, then
              creates a review draft with commercial mechanics, offering-specific buyer
              logic, scoped rules, and focused clarification questions.
            </p>
            {!currentWorkspace.websiteUrl ? (
              <Badge tone="warning">
                Save the company website URL before starting analysis.
              </Badge>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}

function errorMessage(error: string) {
  const messages: Record<string, string> = {
    "invalid-website-url": "Enter a valid public HTTP or HTTPS website URL.",
    "website-required": "Save a website URL before starting website analysis.",
    "company-intelligence-required":
      "Create and publish Company Intelligence before creating a campaign.",
    "structured-profile-required":
      "Create and publish Company Intelligence before creating a campaign.",
    "v3-draft-create-failed":
      "The Company Intelligence review could not be started. Try again.",
    "v3-database-repair-required":
      "Company Intelligence needs the latest database repair migration before analysis can start.",
    "v3-profile-container-missing":
      "The workspace Company Profile container is missing. Clear workspace data again or apply the profile-container repair migration.",
    "v3-trigger-dispatch-failed":
      "The profile draft was created, but Trigger.dev could not start its analysis. Verify the current Trigger deployment and secret key, then retry.",
    "v3-workspace-not-ready":
      "Native Company Intelligence is not enabled for this workspace.",
    "v3-publish-failed":
      "The reviewed Company Intelligence profile could not be published.",
    "v3-publish-stale-audit-gate":
      "Publication is still using the stale consistency-audit gate. Apply the latest optional-review publish migration.",
    "v3-publish-no-active-offering":
      "Keep at least one offering active before publishing Company Intelligence.",
    "v3-publish-missing-model":
      "The draft has no compiled business model and must be analyzed again.",
    "v3-publish-not-ready":
      "This Company Intelligence draft is not in a reviewable state.",
    "v3-publish-forbidden":
      "Only a workspace administrator can publish Company Intelligence.",
    "v3-publish-database-update-required":
      "Apply the latest Company Intelligence publish migration before trying again.",
    "v3-draft-not-reviewable": "This Company Intelligence draft is no longer editable.",
    "v3-core-update-failed":
      "The reviewed Company Intelligence fields could not be saved.",
    "question-answer-required":
      "Choose or enter an answer before saving this clarification question.",
  };
  return (
    messages[error] ??
    `The profile could not be updated because of an unrecognized error (${error}).`
  );
}

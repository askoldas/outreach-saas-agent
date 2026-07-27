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
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";
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
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  const intelligenceSettings = await getWorkspaceIntelligenceSettings(
    currentWorkspace.id,
  );
  const useProfileV3 = intelligenceSettings.profileVersion === "v2";
  const profileV3 = useProfileV3
    ? await getCurrentCompanyProfileV3Review(currentWorkspace.id)
    : null;
  const analysisProgress = await getCampaignResearchProgress({
    campaignId: "company-profile",
    workspaceId: currentWorkspace.id,
  });
  const pendingQuestions = profileV3
    ? profileV3.questions.filter((question) => question.status === "pending").length
    : profile.reviewQuestions.filter((question) => question.status === "unanswered")
        .length;

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
            {!useProfileV3 ? (
              <form action={analyzeCompanyProfileAction}>
                <Button type="submit" disabled={!profile.website}>
                  {profile.structuredProfile
                    ? "Improve profile structure"
                    : "Analyse website"}
                </Button>
              </form>
            ) : null}
            {pendingQuestions ? (
              <ButtonLink
                variant="primary"
                href={profileV3 ? "#profile-v3-review" : "#review-questions"}
              >
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
      {query.message === "v3-profile-published" ? (
        <Badge tone="success">
          Company Intelligence V3 was published as an immutable profile version.
        </Badge>
      ) : null}
      {query.message === "v3-core-updated" ? (
        <Badge tone="success">Reviewed Company Intelligence fields were saved.</Badge>
      ) : null}
      {query.error ? <Badge tone="danger">{errorMessage(query.error)}</Badge> : null}
      <RunProgressPanel
        key={analysisProgress?.runId ?? "no-analysis"}
        endpoint="/api/company-profile/analysis-progress"
        initialProgress={analysisProgress}
        title="Website analysis"
      />
      {!useProfileV3 ? (
        <>
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
        </>
      ) : null}
      {useProfileV3 && profileV3 ? (
        <CompanyProfileV3Workspace review={profileV3} />
      ) : useProfileV3 && profile.structuredProfile ? (
        <Card>
          <CardHeader
            title="Create Company Intelligence review"
            eyebrow="Upgrade the reviewed profile into the V3 commercial model"
            action={
              <form action={createCompanyProfileV3DraftAction}>
                <Button type="submit" variant="primary">
                  Build V3 review
                </Button>
              </form>
            }
          />
          <div className={styles.cardBody}>
            <p>
              Your existing profile remains unchanged. Opptium will create a separate
              review draft with commercial mechanics, offering-specific buyer logic,
              scoped rules, and focused clarification questions.
            </p>
          </div>
        </Card>
      ) : (
        <CompanyProfileWorkspace profile={profile} />
      )}
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
    "v3-draft-create-failed":
      "The Company Intelligence review could not be started. Try again.",
    "v3-blocking-questions":
      "Answer all blocking clarification questions before publishing.",
    "v3-publish-failed":
      "The reviewed Company Intelligence profile could not be published.",
    "v3-draft-not-reviewable": "This Company Intelligence draft is no longer editable.",
    "v3-core-update-failed":
      "The reviewed Company Intelligence fields could not be saved.",
  };
  return messages[error] ?? "The profile could not be updated.";
}

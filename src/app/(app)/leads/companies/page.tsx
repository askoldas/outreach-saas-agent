import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlobalLeadsNav } from "@/features/leads/GlobalLeadsNav";
import { GlobalCompaniesTable } from "@/features/leads/GlobalCompaniesTable";
import styles from "@/features/shared/Feature.module.css";
import { listCampaigns } from "@/server/campaigns/repository";
import { listLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type Query = {
  campaign?: string;
  company?: string;
  geography?: string;
  industry?: string;
  status?: string;
};

export default async function GlobalCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [{ currentWorkspace }, query] = await Promise.all([
    getWorkspaceContext(),
    searchParams,
  ]);
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const [companies, campaigns] = await Promise.all([
    listLeads(currentWorkspace.id),
    listCampaigns(currentWorkspace.id),
  ]);
  const rows = companies.filter(
    (company) =>
      matches(query.campaign, company.campaignId) &&
      includes(query.company, company.company) &&
      includes(query.geography, `${company.country} ${company.city}`) &&
      includes(query.industry, company.industry) &&
      matches(query.status, company.status),
  );
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Leads"
        description="Companies discovered and qualified across every campaign, including those without contacts."
      />
      <GlobalLeadsNav active="companies" />
      <Card>
        <CardHeader title="Companies" eyebrow={`${rows.length} discovered companies`} />
        <form className={styles.filterBar} method="get">
          <input
            name="company"
            defaultValue={query.company}
            placeholder="Search companies…"
            aria-label="Search companies"
          />
          <select
            name="campaign"
            defaultValue={query.campaign ?? ""}
            aria-label="Filter by campaign"
          >
            <option value="">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <input
            name="geography"
            defaultValue={query.geography}
            placeholder="Geography"
            aria-label="Filter by geography"
          />
          <input
            name="industry"
            defaultValue={query.industry}
            placeholder="Industry"
            aria-label="Filter by industry"
          />
          <select
            name="status"
            defaultValue={query.status ?? ""}
            aria-label="Filter by review status"
          >
            <option value="">All statuses</option>
            <option value="needs_review">Needs review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
          <button type="submit">Apply filters</button>
        </form>
        {rows.length ? (
          <GlobalCompaniesTable companies={rows} campaigns={campaigns} />
        ) : (
          <div className={styles.emptyState}>
            <p>No discovered companies match these filters.</p>
            <ButtonLink href="/campaigns/new" variant="primary">
              Create campaign
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}

function includes(filter: string | undefined, value: string) {
  return !filter || value.toLowerCase().includes(filter.toLowerCase());
}
function matches(filter: string | undefined, value: string) {
  return !filter || filter === value;
}

import { Badge } from "@/components/ui/Badge";
import type { CampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";

export function ProgressiveCompanyResults({
  companies,
}: {
  companies: CampaignWorkflowSummary["progressiveCompanies"];
}) {
  return (
    <section aria-labelledby="progressive-company-results">
      <h3 id="progressive-company-results">Companies</h3>
      <p>
        {companies.length
          ? `${companies.length} resolved companies available while research continues.`
          : "Resolved companies will appear here as research progresses."}
      </p>
      {companies.length ? (
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Research state</th>
                <th>Identity</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <strong>{company.name}</strong>
                    {company.websiteUrl ? (
                      <a href={company.websiteUrl} rel="noreferrer" target="_blank">
                        {company.domain ?? company.websiteUrl}
                      </a>
                    ) : company.domain ? (
                      <span>{company.domain}</span>
                    ) : null}
                  </td>
                  <td>
                    <Badge tone={stateTone(company.state)}>
                      {company.state.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td>
                    {company.identityReviewState.replaceAll("_", " ")}
                    <span className={shared.secondaryText}>
                      {Math.round(company.identityConfidence * 100)}% confidence
                    </span>
                  </td>
                  <td>{company.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function stateTone(state: string) {
  if (/qualified|recommended|evaluated/.test(state)) return "success" as const;
  if (/rejected|excluded|invalid/.test(state)) return "danger" as const;
  if (/research|resolved|candidate/.test(state)) return "accent" as const;
  return "neutral" as const;
}

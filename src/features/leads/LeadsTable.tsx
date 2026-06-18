"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { confidenceTone, scoreTone, statusLabel, statusTone } from "@/lib/format";
import type { Campaign, Lead } from "@/types/domain";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";

export function LeadsTable({
  campaigns,
  leads,
}: Readonly<{ campaigns: Campaign[]; leads: Lead[] }>) {
  const [query, setQuery] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [score, setScore] = useState("all");
  const [sort, setSort] = useState<"score" | "company">("score");

  const countries = Array.from(new Set(leads.map((lead) => lead.country)));
  const filtered = useMemo(() => {
    return leads
      .filter((lead) =>
        `${lead.company} ${lead.industry}`.toLowerCase().includes(query.toLowerCase()),
      )
      .filter((lead) => campaignId === "all" || lead.campaignId === campaignId)
      .filter((lead) => country === "all" || lead.country === country)
      .filter((lead) => status === "all" || lead.status === status)
      .filter((lead) => score === "all" || lead.fitScore >= Number(score))
      .sort((a, b) =>
        sort === "score" ? b.fitScore - a.fitScore : a.company.localeCompare(b.company),
      );
  }, [campaignId, country, leads, query, score, sort, status]);

  return (
    <>
      <div className={styles.filters}>
        <label className={form.field} htmlFor="lead-search">
          <span>Text search</span>
          <input
            className={form.input}
            id="lead-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Company or industry"
          />
        </label>
        <Select
          label="Campaign"
          value={campaignId}
          onChange={setCampaignId}
          options={[
            ["all", "All campaigns"],
            ...campaigns.map((campaign) => [campaign.id, campaign.name] as const),
          ]}
        />
        <Select
          label="Country"
          value={country}
          onChange={setCountry}
          options={[
            ["all", "All countries"],
            ...countries.map((item) => [item, item] as const),
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            ["all", "All statuses"],
            ["needs_review", "Needs review"],
            ["approved", "Approved"],
            ["draft_ready", "Draft ready"],
            ["researching", "Researching"],
          ]}
        />
        <Select
          label="Score"
          value={score}
          onChange={setScore}
          options={[
            ["all", "Any score"],
            ["80", "80+"],
            ["70", "70+"],
            ["60", "60+"],
          ]}
        />
        <Select
          label="Sort"
          value={sort}
          onChange={(value) => setSort(value as "score" | "company")}
          options={[
            ["score", "Fit score"],
            ["company", "Company"],
          ]}
        />
      </div>

      {leads.length === 0 ? (
        <p className={styles.secondaryText}>
          No leads have been saved for this workspace yet.
        </p>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Website</th>
              <th>Location</th>
              <th>Campaign</th>
              <th>Type</th>
              <th>Fit</th>
              <th>Confidence</th>
              <th>Contactability</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link className={styles.primaryText} href={`/leads/${lead.id}`}>
                    {lead.company}
                  </Link>
                  <span className={styles.secondaryText}>{lead.industry}</span>
                </td>
                <td>{lead.website.replace("https://", "")}</td>
                <td>
                  {lead.city}, {lead.country}
                </td>
                <td>
                  {campaigns.find((campaign) => campaign.id === lead.campaignId)?.name}
                </td>
                <td>{lead.companyType}</td>
                <td>
                  <Badge tone={scoreTone(lead.fitScore)}>{lead.fitScore}</Badge>
                </td>
                <td>
                  <Badge tone={confidenceTone(lead.confidence)}>
                    {statusLabel(lead.confidence)}
                  </Badge>
                </td>
                <td>
                  <Badge tone={confidenceTone(lead.contactability)}>
                    {statusLabel(lead.contactability)}
                  </Badge>
                </td>
                <td>
                  <Badge tone={statusTone(lead.status)}>{statusLabel(lead.status)}</Badge>
                </td>
                <td>
                  <ButtonLink href={`/leads/${lead.id}`}>Review</ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.secondaryText}>
        Showing {filtered.length} of {leads.length} workspace leads.
      </p>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}>) {
  const id = `filter-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label className={form.field} htmlFor={id}>
      <span>{label}</span>
      <select
        className={form.select}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

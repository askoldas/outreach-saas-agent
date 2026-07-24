"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { Campaign, Lead } from "@/types/domain";
import { fitLabel } from "@/lib/opptium/domain";
import { scoreTone, statusLabel, statusTone } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import styles from "@/features/shared/Feature.module.css";

export function GlobalCompaniesTable({
  campaigns,
  companies,
}: Readonly<{ campaigns: Campaign[]; companies: Lead[] }>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: 42 }} />
          <col style={{ width: 210 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 82 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            <th>
              <span className="sr-only">Select</span>
            </th>
            <th>Company</th>
            <th>Location</th>
            <th>Industry</th>
            <th>Fit</th>
            <th>Contacts</th>
            <th>Campaign</th>
            <th>Status</th>
            <th>Updated</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const campaign = campaignById.get(company.campaignId);
            const open = expanded === company.id;
            return (
              <Fragment key={company.id}>
                <tr>
                  <td>
                    <input type="checkbox" aria-label={`Select ${company.company}`} />
                  </td>
                  <td title={`${company.company} · ${company.website || "No website"}`}>
                    <Link
                      className={styles.primaryText}
                      href={`/campaigns/${company.campaignId}/leads?lead=${company.id}`}
                    >
                      {company.company}
                    </Link>
                    <span className={styles.secondaryText}>
                      {domain(company.website)}
                    </span>
                  </td>
                  <td title={[company.city, company.country].filter(Boolean).join(", ")}>
                    {company.city && company.city !== "Unknown"
                      ? `${company.city}, `
                      : ""}
                    {company.country}
                  </td>
                  <td title={company.industry}>{company.industry || "Not available"}</td>
                  <td>
                    <Badge tone={scoreTone(company.fitScore)}>
                      {company.fitScore} · {fitLabel(company.fitScore)}
                    </Badge>
                  </td>
                  <td title="Named person contacts are not represented by the current schema">
                    0
                  </td>
                  <td title={campaign?.name}>{campaign?.name ?? "Unavailable"}</td>
                  <td>
                    <Badge tone={statusTone(company.status)}>
                      {statusLabel(company.status)}
                    </Badge>
                  </td>
                  <td title={campaign?.lastActivity}>
                    {campaign?.lastActivity ?? "Not recorded"}
                  </td>
                  <td>
                    <button
                      className={styles.expandButton}
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Collapse" : "Expand"} ${company.company}`}
                      onClick={() => setExpanded(open ? null : company.id)}
                    >
                      {open ? "⌃" : "⌄"}
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr className={styles.expandedRow}>
                    <td colSpan={10}>
                      <div className={styles.detailGrid}>
                        <section>
                          <h3>Company overview</h3>
                          <p>{company.description || "No description stored."}</p>
                          <p>
                            {company.website ? (
                              <a href={company.website} target="_blank" rel="noreferrer">
                                {company.website}
                              </a>
                            ) : (
                              "Website not found"
                            )}
                          </p>
                          <p>
                            {company.industry} · {company.estimatedSize}
                          </p>
                        </section>
                        <section>
                          <h3>Qualification</h3>
                          <p>
                            <strong>
                              {company.fitScore} · {fitLabel(company.fitScore)}
                            </strong>
                          </p>
                          <p>{company.summary}</p>
                          {company.qualification.map((item) => (
                            <p key={item.label}>
                              {item.label}: {item.explanation}
                            </p>
                          ))}
                        </section>
                        <section>
                          <h3>Public company channels</h3>
                          {company.contacts.length ? (
                            company.contacts.map((contact) => (
                              <p key={`${contact.type}-${contact.value}`}>
                                <strong>{contact.type}:</strong> {contact.value} ·{" "}
                                {statusLabel(contact.verification)}
                              </p>
                            ))
                          ) : (
                            <p>No public channels stored.</p>
                          )}
                          <p>
                            Named person contacts are not represented by the current
                            schema.
                          </p>
                        </section>
                      </div>
                      <section>
                        <h3>Evidence</h3>
                        {company.evidence.length ? (
                          company.evidence.map((item) => (
                            <p key={item.id}>
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                                {item.sourceLabel}
                              </a>{" "}
                              — {item.text}
                            </p>
                          ))
                        ) : (
                          <p>No evidence stored.</p>
                        )}
                      </section>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function domain(website: string) {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website || "No website";
  }
}

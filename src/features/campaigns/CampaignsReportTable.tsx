"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { Campaign } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";

export type CampaignReportRow = { campaign: Campaign; contacts: number; drafts: number };

export function CampaignsReportTable({ rows }: Readonly<{ rows: CampaignReportRow[] }>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: 220 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 190 }} />
          <col style={{ width: 105 }} />
          <col style={{ width: 115 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Market</th>
            <th>Progress</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Next action</th>
            <th>Updated</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ campaign, contacts, drafts }) => {
            const open = expanded === campaign.id;
            const next = nextAction(campaign, contacts, drafts);
            return (
              <Fragment key={campaign.id}>
                <tr>
                  <td title={`${campaign.name} · ${campaign.objective}`}>
                    <Link
                      className={styles.primaryText}
                      href={`/campaigns/${campaign.id}`}
                    >
                      {campaign.name}
                    </Link>
                    <span className={styles.secondaryText}>
                      {campaign.targetSegments.slice(0, 2).join(", ")}
                    </span>
                  </td>
                  <td
                    title={`${campaign.geography} · ${campaign.industryTerms.join(", ")}`}
                  >
                    {campaign.geography} · {campaign.industryTerms[0] ?? "All industries"}
                  </td>
                  <td>
                    {campaign.leadCount} companies · {contacts} contacts ·{" "}
                    {drafts ? `${drafts} drafts` : "No draft"}
                  </td>
                  <td>{stage(campaign, contacts, drafts)}</td>
                  <td>
                    <Badge tone={statusTone(campaign.status)}>
                      {statusLabel(campaign.status)}
                    </Badge>
                  </td>
                  <td>
                    <Link className={styles.primaryText} href={next.href}>
                      {next.label}
                    </Link>
                  </td>
                  <td title={campaign.lastActivity}>{campaign.lastActivity}</td>
                  <td>
                    <button
                      className={styles.expandButton}
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Collapse" : "Expand"} ${campaign.name}`}
                      onClick={() => setExpanded(open ? null : campaign.id)}
                    >
                      {open ? "⌃" : "⌄"}
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr className={styles.expandedRow}>
                    <td colSpan={8}>
                      <div className={styles.detailGrid}>
                        <section>
                          <h3>Campaign</h3>
                          <p>{campaign.objective}</p>
                          <p>
                            {campaign.geography} · {campaign.language}
                          </p>
                        </section>
                        <section>
                          <h3>Targeting</h3>
                          <p>
                            <strong>Segments:</strong>{" "}
                            {campaign.targetSegments.join(", ") || "Not set"}
                          </p>
                          <p>
                            <strong>Industries:</strong>{" "}
                            {campaign.industryTerms.join(", ") || "Not set"}
                          </p>
                          <p>
                            <strong>Criteria:</strong>{" "}
                            {campaign.strategy.criteria.join(", ") || "Not set"}
                          </p>
                        </section>
                        <section>
                          <h3>Results and attention</h3>
                          <p>
                            {campaign.leadCount} companies · {contacts} public channels ·{" "}
                            {drafts} drafts
                          </p>
                          <p>{campaign.awaitingReview} awaiting review</p>
                          {campaign.warnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </section>
                      </div>
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

function stage(campaign: Campaign, contacts: number, drafts: number) {
  if (drafts) return "Sequence";
  if (contacts) return "Contacts";
  return campaign.status === "planning" ? "Discover setup" : "Discover";
}
function nextAction(campaign: Campaign, contacts: number, drafts: number) {
  if (drafts)
    return {
      href: `/campaigns/${campaign.id}/outreach?view=drafts`,
      label: "Review sequence",
    };
  if (contacts)
    return {
      href: `/campaigns/${campaign.id}/outreach?view=contacts`,
      label: "Create sequence",
    };
  if (campaign.status === "completed")
    return { href: `/campaigns/${campaign.id}/leads`, label: "Review companies" };
  return { href: `/campaigns/${campaign.id}/strategy`, label: "Prepare discovery" };
}

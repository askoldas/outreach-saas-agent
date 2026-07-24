"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { Campaign, OutreachDraft } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import styles from "@/features/shared/Feature.module.css";

export type SequenceReportRow = { campaign: Campaign; drafts: OutreachDraft[] };

export function SequencesReportTable({ rows }: Readonly<{ rows: SequenceReportRow[] }>) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: 210 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Sequence</th>
            <th>Campaign</th>
            <th>Recipients</th>
            <th>Drafts</th>
            <th>Status</th>
            <th>Sent</th>
            <th>Replies</th>
            <th>Next activity</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ campaign, drafts }) => {
            const open = expanded === campaign.id;
            const recipients = new Set(drafts.map((draft) => draft.leadId)).size;
            const needsReview = drafts.filter(
              (draft) => draft.status === "needs_review",
            ).length;
            return (
              <Fragment key={campaign.id}>
                <tr>
                  <td title={`${campaign.name} outreach`}>
                    <Link
                      className={styles.primaryText}
                      href={`/campaigns/${campaign.id}/outreach?view=drafts`}
                    >
                      {campaign.name} outreach
                    </Link>
                  </td>
                  <td title={campaign.name}>{campaign.name}</td>
                  <td>{recipients}</td>
                  <td>{drafts.length}</td>
                  <td>
                    <Badge tone={needsReview ? "warning" : "success"}>
                      {needsReview ? `${needsReview} need review` : "Prepared"}
                    </Badge>
                  </td>
                  <td title="Sending is not connected">—</td>
                  <td title="Reply tracking is not connected">—</td>
                  <td title="No sending schedule is stored">Review drafts</td>
                  <td>
                    <button
                      className={styles.expandButton}
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Collapse" : "Expand"} ${campaign.name} outreach`}
                      onClick={() => setExpanded(open ? null : campaign.id)}
                    >
                      {open ? "⌃" : "⌄"}
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr className={styles.expandedRow}>
                    <td colSpan={9}>
                      <div className={styles.detailGrid}>
                        <section>
                          <h3>Sequence status</h3>
                          <p>
                            {recipients} recipients · {drafts.length} prepared drafts
                          </p>
                          <p>
                            Mailbox, sending schedule, delivery, and replies are not
                            represented by the current schema.
                          </p>
                        </section>
                        <section>
                          <h3>Draft steps</h3>
                          {drafts.map((draft) => (
                            <p key={draft.id}>
                              <strong>{draft.variant}:</strong>{" "}
                              {draft.subject || "No subject"}
                            </p>
                          ))}
                        </section>
                        <section>
                          <h3>Warnings and activity</h3>
                          {drafts.flatMap((draft) => draft.warnings).length ? (
                            drafts
                              .flatMap((draft) => draft.warnings)
                              .map((warning, index) => (
                                <p key={`${warning}-${index}`}>{warning}</p>
                              ))
                          ) : (
                            <p>No draft warnings.</p>
                          )}
                          <p>
                            Last edited: {drafts[0]?.lastEdited ?? campaign.lastActivity}
                          </p>
                        </section>
                      </div>
                      <Link href={`/campaigns/${campaign.id}/outreach?view=drafts`}>
                        Open full sequence workspace
                      </Link>
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

"use client";
import { Fragment, useMemo, useState, useTransition } from "react";
import type { Lead, ReviewState } from "@/types/domain";
import { fitLabel, confidenceLabel, leadReviewState } from "@/lib/opptium/domain";
import { updateLeadReviewAction } from "@/server/leads/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";
const tabs: { key: ReviewState; label: string }[] = [
  { key: "ready", label: "Ready for review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "excluded", label: "Excluded" },
  { key: "issues", label: "Research issues" },
];
export function CampaignLeadReview({
  initialLeads,
  initialView = "ready",
  campaignId,
}: {
  initialLeads: Lead[];
  initialView?: ReviewState;
  campaignId: string;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState<ReviewState>(initialView);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(
    () => leads.filter((lead) => leadReviewState(lead) === view),
    [leads, view],
  );
  function decide(
    id: string,
    status: "approved" | "rejected" | "archived" | "needs_review" | "researching",
  ) {
    startTransition(async () => {
      try {
        const result = await updateLeadReviewAction({ campaignId, leadId: id, status });
        setLeads((items) =>
          items.map((lead) => (lead.id === id ? { ...lead, status } : lead)),
        );
        setMessage(result.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update lead");
      }
    });
  }
  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={view === tab.key ? "primary" : "secondary"}
            onClick={() => setView(tab.key)}
          >
            {tab.label} (
            {leads.filter((lead) => leadReviewState(lead) === tab.key).length})
          </Button>
        ))}
      </div>
      {message ? <Badge tone="accent">{message}</Badge> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Select</th>
              <th>Company</th>
              <th>Location</th>
              <th>Fit</th>
              <th>Confidence</th>
              <th>Review status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((lead) => (
              <Fragment key={lead.id}>
                <tr>
                  <td>
                    <input type="checkbox" aria-label={`Select ${lead.company}`} />
                  </td>
                  <td>
                    <strong className={styles.primaryText}>{lead.company}</strong>
                    <span className={styles.secondaryText}>
                      {lead.website} · {lead.companyType}
                    </span>
                  </td>
                  <td>
                    {lead.country}
                    <span className={styles.secondaryText}>{lead.city}</span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        lead.fitScore >= 80
                          ? "success"
                          : lead.fitScore >= 45
                            ? "warning"
                            : "danger"
                      }
                    >
                      {lead.fitScore} · {fitLabel(lead.fitScore)}
                    </Badge>
                  </td>
                  <td>{confidenceLabel(lead.confidence)}</td>
                  <td>{leadReviewState(lead)}</td>
                  <td>
                    <div className={styles.filters}>
                      <Button
                        variant="ghost"
                        onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                      >
                        {expanded === lead.id ? "Collapse" : "Expand"}
                      </Button>
                      <Button
                        disabled={pending}
                        onClick={() => decide(lead.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={pending}
                        onClick={() => decide(lead.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded === lead.id ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.twoColumn}>
                        <section>
                          <h3>Company overview</h3>
                          <p>{lead.description}</p>
                          <h3>Why it matches</h3>
                          <p>{lead.summary}</p>
                          <ul className={styles.feed}>
                            {lead.qualification.map((item) => (
                              <li key={item.label}>
                                <strong>
                                  {item.label}: {item.score}
                                </strong>
                                <p>{item.explanation}</p>
                              </li>
                            ))}
                          </ul>
                        </section>
                        <section>
                          <h3>Evidence</h3>
                          <ul className={styles.feed}>
                            {lead.evidence.length ? (
                              lead.evidence.map((item) => (
                                <li key={item.id}>
                                  <strong>
                                    {item.kind}: {item.text}
                                  </strong>
                                  <p>
                                    <a href={item.sourceUrl}>{item.sourceLabel}</a>
                                  </p>
                                </li>
                              ))
                            ) : (
                              <li>
                                <strong>No supporting evidence stored</strong>
                              </li>
                            )}
                          </ul>
                          <h3>Basic public contacts</h3>
                          <ul className={styles.feed}>
                            {lead.contacts.map((contact) => (
                              <li key={contact.value}>
                                <strong>{contact.value}</strong>
                                <p>
                                  {contact.suggestedRole} · {contact.verification}
                                  {contact.verificationProvenance
                                    ? ` · ${contact.verificationProvenance.provider}`
                                    : ""}
                                </p>
                              </li>
                            ))}
                          </ul>
                          <h3>Notes and warnings</h3>
                          <textarea
                            aria-label="Lead notes"
                            placeholder="Lead notes are not persisted yet."
                          />
                        </section>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 ? (
        <p className={styles.secondaryText}>No companies in this view.</p>
      ) : null}
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ExportRecord,
  Lead,
  OutreachDraft,
  RecommendedRecipient,
  ResearchProgress,
} from "@/types/domain";
import { estimateCredits } from "@/lib/opptium/domain";
import { updateDraftReviewAction } from "@/server/drafts/actions";
import {
  acceptRecipientSelectionsAction,
  createExportAction,
  queueContactEnrichmentAction,
  queueDraftGenerationAction,
} from "@/server/outreach/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";
import { RunProgressPanel } from "@/features/progress/RunProgressPanel";
type Tab = "contacts" | "drafts" | "exports";
export function OutreachWorkspace({
  recipients,
  drafts,
  companyByLeadId,
  leads,
  campaignId,
  exportHistory,
  initialView = "contacts",
  initialRunProgress,
}: {
  recipients: RecommendedRecipient[];
  drafts: OutreachDraft[];
  companyByLeadId: Record<string, string>;
  leads: Lead[];
  campaignId: string;
  exportHistory: ExportRecord[];
  initialView?: Tab;
  initialRunProgress: ResearchProgress | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialView);
  const [message, setMessage] = useState("");
  const [draftRows, setDraftRows] = useState(drafts);
  const [pending, startTransition] = useTransition();
  async function download() {
    const csv =
      "company,recipient,route,subject,body\n" +
      draftRows
        .map(
          (d) =>
            `"${escapeCsv(companyByLeadId[d.leadId] ?? "Unknown company")}","${escapeCsv(d.recipientRoute)}","${escapeCsv(d.recipientRoute)}","${escapeCsv(d.subject)}","${escapeCsv(d.body)}"`,
        )
        .join("\n");
    await createExportAction({
      campaignId,
      type: "outreach_csv",
      fileName: "opptium-outreach.csv",
      rows: draftRows.map((draft) => ({
        ...draft,
        company: companyByLeadId[draft.leadId] ?? "Unknown company",
      })),
    });
    downloadCsv("opptium-outreach.csv", csv);
    setMessage("Outreach CSV recorded and downloaded.");
  }
  function updateDraft(draftId: string, key: "subject" | "body", value: string) {
    setDraftRows((rows) =>
      rows.map((draft) =>
        draft.id === draftId ? { ...draft, [key]: value, status: "edited" } : draft,
      ),
    );
  }
  function saveDraft(draft: OutreachDraft) {
    startTransition(async () => {
      try {
        const result = await updateDraftReviewAction({
          draftId: draft.id,
          campaignId,
          subject: draft.subject,
          body: draft.body,
          status: "edited",
        });
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save draft");
      }
    });
  }
  async function downloadLeadResearch() {
    const header =
      "company,website,location,company_type,industry,fit_score,confidence,qualification,evidence,source_urls,review_status,contacts";
    const rows = leads.map((lead) =>
      [
        lead.company,
        lead.website,
        [lead.city, lead.country].filter(Boolean).join(", "),
        lead.companyType,
        lead.industry,
        String(lead.fitScore),
        lead.confidence,
        lead.summary,
        lead.evidence.map((item) => item.text).join(" | "),
        lead.evidence.map((item) => item.sourceUrl).join(" | "),
        lead.status,
        lead.contacts.map((item) => item.value).join(" | "),
      ]
        .map((value) => `"${escapeCsv(value)}"`)
        .join(","),
    );
    await createExportAction({
      campaignId,
      type: "lead_research_csv",
      fileName: "opptium-lead-research.csv",
      rows: leads,
    });
    downloadCsv("opptium-lead-research.csv", [header, ...rows].join("\n"));
    setMessage("Lead Research CSV recorded and downloaded.");
  }
  function acceptSelections() {
    startTransition(async () => {
      try {
        const result = await acceptRecipientSelectionsAction({
          campaignId,
          selections: recipients.map((item) => ({
            leadId: item.leadId,
            contactRouteId: item.contactRouteId,
            reason: item.reason,
          })),
        });
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save selections");
      }
    });
  }
  function enrichApproved() {
    const estimated = estimateCredits("enrichment", recipients.length);
    startTransition(async () => {
      try {
        const result = await queueContactEnrichmentAction({
          campaignId,
          leadIds: recipients.map((item) => item.leadId),
          estimatedCredits: estimated,
        });
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not queue enrichment");
      }
    });
  }
  function generateDrafts() {
    startTransition(async () => {
      try {
        const result = await queueDraftGenerationAction({ campaignId });
        setMessage(result.message);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not generate drafts");
      }
    });
  }
  return (
    <div className={styles.stack}>
      <RunProgressPanel
        key={initialRunProgress?.runId ?? "no-run"}
        endpoint={`/api/campaigns/${encodeURIComponent(campaignId)}/discovery-progress`}
        initialProgress={initialRunProgress}
        title="Latest campaign operation"
      />
      <div className={styles.filters}>
        {(["contacts", "drafts", "exports"] as Tab[]).map((value) => (
          <Button
            key={value}
            variant={tab === value ? "primary" : "secondary"}
            onClick={() => setTab(value)}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Button>
        ))}
      </div>
      {message ? <Badge tone="success">{message}</Badge> : null}
      {tab === "contacts" ? (
        <Card>
          <CardHeader
            title="Recommended company channels"
            eyebrow="Persisted public routes; not named-person leads"
            action={
              <Button
                disabled={pending || recipients.length === 0}
                onClick={enrichApproved}
              >
                Enrich selected
              </Button>
            }
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Selected channel</th>
                  <th>Type</th>
                  <th>Verification</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((item) => (
                  <tr key={item.company}>
                    <td>{item.company}</td>
                    <td>
                      {item.name}
                      <span className={styles.secondaryText}>{item.route}</span>
                    </td>
                    <td>{item.type}</td>
                    <td>{item.verification}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      Approve companies with stored public contact routes to build this
                      queue.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={styles.cardBody}>
            <Button
              disabled={pending || recipients.length === 0}
              onClick={acceptSelections}
            >
              Accept recommended selections
            </Button>
          </div>
        </Card>
      ) : null}
      {tab === "drafts" ? (
        <Card>
          <CardHeader
            title="Draft review queue"
            eyebrow="One primary recipient per company"
            action={
              <Button
                disabled={pending || recipients.length === 0}
                onClick={generateDrafts}
              >
                Create sequence for selected channels (
                {estimateCredits("draft", recipients.length)} credits est.)
              </Button>
            }
          />
          <div className={styles.cardBody}>
            {draftRows.map((draft) => (
              <section key={draft.id} className={styles.stack}>
                <input
                  value={draft.subject}
                  aria-label={`Subject for ${draft.recipientRoute}`}
                  onChange={(event) =>
                    updateDraft(draft.id, "subject", event.target.value)
                  }
                />
                <p className={styles.secondaryText}>
                  {draft.recipientRoute} · {draft.status}
                </p>
                {draft.promptVersion ? (
                  <p className={styles.secondaryText}>
                    Grounded generation: {draft.promptVersion}
                    {draft.generatedAt
                      ? ` · ${new Date(draft.generatedAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
                <textarea
                  value={draft.body}
                  onChange={(event) => updateDraft(draft.id, "body", event.target.value)}
                  aria-label={`Draft for ${draft.recipientRoute}`}
                  rows={10}
                />
                <Button disabled={pending} onClick={() => saveDraft(draft)}>
                  Save draft edits
                </Button>
                <ul className={styles.feed}>
                  {draft.warnings.map((warning) => (
                    <li key={warning}>
                      <strong>Warning</strong>
                      <p>{warning}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {draftRows.length === 0 ? (
              <p>No persisted drafts exist for this campaign yet.</p>
            ) : null}
          </div>
        </Card>
      ) : null}
      {tab === "exports" ? (
        <Card>
          <CardHeader
            title="Export history"
            eyebrow="Human-controlled export boundary"
            action={
              <Button variant="primary" onClick={download}>
                Export Outreach CSV
              </Button>
            }
          />
          <div className={styles.cardBody}>
            <p>
              Outreach CSV and Lead Research CSV are prepared for use outside Opptium. No
              mailbox or sending integration exists.
            </p>
            <Button onClick={downloadLeadResearch}>Export Lead Research CSV</Button>
            <h3>Recorded exports</h3>
            <ul className={styles.feed}>
              {exportHistory.map((item) => (
                <li key={item.id}>
                  <strong>{item.fileName}</strong>
                  <p>
                    {item.type} · {item.rowCount} rows ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <a href={`/api/exports/${item.id}/download`}>Download frozen CSV</a>
                </li>
              ))}
              {exportHistory.length === 0 ? (
                <li>
                  <strong>No exports recorded yet</strong>
                </li>
              ) : null}
            </ul>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function escapeCsv(value: string) {
  return value.replaceAll('"', '""');
}
function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

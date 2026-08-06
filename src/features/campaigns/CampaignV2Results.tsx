"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  proposeV2CandidateCorrectionAction,
  reviewV2CandidateAction,
} from "@/server/campaign-results-v2/actions";
import {
  resultLanes,
  type CampaignV2Results as Results,
  type ResultLane,
} from "@/server/campaign-results-v2/types";
import styles from "./CampaignV2Results.module.css";

const laneLabels: Record<ResultLane, string> = {
  conditional: "Conditional",
  excluded: "Excluded",
  invalid_duplicate: "Invalid & duplicates",
  needs_research: "Needs research",
  recommended: "Recommended",
  rejected: "Rejected",
};

type ResultView = "all" | ResultLane;

export function CampaignV2Results({
  campaignId,
  results,
}: {
  campaignId: string;
  results: Results;
}) {
  const [view, setView] = useState<ResultView>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return results.candidates.filter(
      (candidate) =>
        (view === "all" || candidate.lane === view) &&
        (!needle ||
          [
            candidate.name,
            candidate.domain,
            candidate.location,
            candidate.relationship,
            ...candidate.archetypes,
          ].some((value) => value?.toLowerCase().includes(needle))),
    );
  }, [query, results.candidates, view]);

  function decide(
    candidate: Results["candidates"][number],
    decision: string,
    formData?: FormData,
  ) {
    startTransition(async () => {
      try {
        const result = await reviewV2CandidateAction({
          campaignCandidateId: candidate.candidateId,
          campaignExternalId: campaignId,
          campaignRunId: results.runId,
          condition: String(formData?.get("condition") ?? ""),
          decision,
          evaluationVersionId: candidate.evaluationId,
          reason: String(formData?.get("reason") ?? ""),
        });
        setMessage(result.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save review.");
      }
    });
  }

  function correct(candidate: Results["candidates"][number], formData: FormData) {
    startTransition(async () => {
      try {
        const result = await proposeV2CandidateCorrectionAction({
          campaignCandidateId: candidate.candidateId,
          campaignExternalId: campaignId,
          campaignRunId: results.runId,
          correctionType: String(formData.get("correctionType")),
          evaluationVersionId: candidate.evaluationId,
          proposedValue: String(formData.get("proposedValue")),
          reason: String(formData.get("correctionReason")),
          scope: String(formData.get("scope")),
        });
        setMessage(result.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save correction.");
      }
    });
  }

  return (
    <section className={styles.workspace} aria-labelledby="v2-results-heading">
      <div>
        <h2 id="v2-results-heading">Campaign results</h2>
        <p className={styles.muted}>
          Canonical V2 ranking for Run {results.runId.slice(0, 8)} · {results.runStatus}
        </p>
        <p className={styles.muted}>
          Applied memory snapshot:{" "}
          {results.appliedMemorySnapshotId?.slice(0, 8) ?? "none"}
        </p>
      </div>

      <div className={styles.summary}>
        <section className={styles.panel}>
          <h3>Coverage</h3>
          <p>{results.coverage.length} segment assessments</p>
          <ul className={styles.auditList}>
            {results.coverage.slice(0, 5).map((item) => (
              <li key={item.id}>
                <strong>
                  {item.archetype} · {item.geography}
                </strong>
                <div>
                  {item.status} · {formatScore(item.confidence)} confidence
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.panel}>
          <h3>Discovery gaps</h3>
          <p>{results.gaps.filter((gap) => gap.status !== "resolved").length} open</p>
          <ul className={styles.auditList}>
            {results.gaps.slice(0, 5).map((gap) => (
              <li key={gap.id}>
                <strong>{gap.severity}</strong>
                <div>{gap.description}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.panel}>
          <h3>Ranking checks</h3>
          <p>{results.anomalies.length} comparative anomalies</p>
          <p>
            {
              results.entityReviewCases.filter((item) => item.status !== "resolved")
                .length
            }{" "}
            open entity-resolution cases
          </p>
          {results.anomalies.map((anomaly) => (
            <div className={styles.alert} key={anomaly.id}>
              <strong>
                {anomaly.severity}
                {anomaly.blocking ? " · blocking" : ""}
              </strong>
              <div>{anomaly.explanation}</div>
              <div>{anomaly.recommendation}</div>
            </div>
          ))}
        </section>
      </div>

      <nav className={styles.lanes} aria-label="Result lanes">
        <Button
          aria-pressed={view === "all"}
          onClick={() => setView("all")}
          variant={view === "all" ? "primary" : "secondary"}
        >
          All evaluated ({results.candidates.length})
        </Button>
        {resultLanes.map((item) => (
          <Button
            aria-pressed={view === item}
            key={item}
            onClick={() => setView(item)}
            variant={view === item ? "primary" : "secondary"}
          >
            {laneLabels[item]} ({results.laneCounts[item]})
          </Button>
        ))}
      </nav>
      <div className={styles.filters}>
        <label>
          <span className={styles.muted}>Search results</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Company, domain, geography, relationship…"
            type="search"
            value={query}
          />
        </label>
      </div>
      {message ? <p role="status">{message}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.muted}>
            {view === "all" ? "All evaluated" : laneLabels[view]} candidates, ranked
            within this Campaign Run.
          </caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Outcome</th>
              <th scope="col">Relationship</th>
              <th scope="col">Archetype</th>
              <th scope="col">Fit</th>
              <th scope="col">Potential</th>
              <th scope="col">Confidence</th>
              <th scope="col">Strongest evidence</th>
              <th scope="col">Location</th>
              <th scope="col">Review</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((candidate) => (
              <tr key={candidate.candidateId}>
                <td>
                  <span className={styles.company}>
                    <strong>
                      #{candidate.rank} {candidate.name}
                    </strong>
                    {candidate.websiteUrl ? (
                      <a href={candidate.websiteUrl} rel="noreferrer" target="_blank">
                        {candidate.domain ?? candidate.websiteUrl}
                      </a>
                    ) : (
                      candidate.domain
                    )}
                    {candidate.sourceUrl &&
                    candidate.sourceUrl !== candidate.websiteUrl ? (
                      <a
                        className={styles.muted}
                        href={candidate.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Evidence page
                      </a>
                    ) : null}
                  </span>
                </td>
                <td>
                  <Badge tone={laneTone(candidate.lane)}>
                    {laneLabels[candidate.lane]}
                  </Badge>
                </td>
                <td>
                  {candidate.relationship}
                  <div className={styles.muted}>
                    {formatScore(candidate.relationshipConfidence)}
                  </div>
                </td>
                <td>{candidate.archetypes.join(", ") || "Unclassified"}</td>
                <td>{formatScore(candidate.fit)}</td>
                <td>{formatScore(candidate.potential)}</td>
                <td>{formatScore(candidate.confidence)}</td>
                <td>{candidate.strongestEvidence}</td>
                <td>{candidate.location}</td>
                <td>
                  {candidate.reviewDecision ? (
                    <Badge tone="accent">{candidate.reviewDecision}</Badge>
                  ) : null}
                  <details className={styles.detail}>
                    <summary>Inspect and review</summary>
                    <div className={styles.detailGrid}>
                      <section>
                        <h3>Assessment</h3>
                        <p>
                          <strong>Why discovered:</strong>{" "}
                          {candidate.provenance.discoveryPurpose ?? "Provider match"}
                        </p>
                        <p>
                          <strong>Query / source path:</strong>{" "}
                          {candidate.provenance.discoveryQuery ??
                            "Query text unavailable"}
                          {candidate.provenance.provider
                            ? ` · ${candidate.provenance.provider}`
                            : ""}
                          {candidate.provenance.sourceType
                            ? ` · ${candidate.provenance.sourceType}`
                            : ""}
                        </p>
                        <p>
                          <strong>Preclassification:</strong>{" "}
                          {candidate.provenance.preclassificationDisposition ??
                            "not recorded"}
                          {candidate.provenance.preclassificationConfidence !== null
                            ? ` · ${formatScore(candidate.provenance.preclassificationConfidence)} confidence`
                            : ""}
                        </p>
                        {candidate.provenance.preclassificationReasons.length ? (
                          <p className={styles.muted}>
                            Reasons:{" "}
                            {candidate.provenance.preclassificationReasons.join(", ")}
                          </p>
                        ) : null}
                        <p>{candidate.explanation}</p>
                        <p>
                          <strong>Eligibility:</strong> {candidate.eligibility}
                        </p>
                        <p>{candidate.eligibilityReason}</p>
                        <p>
                          <strong>Organization:</strong> {candidate.organizationType}
                        </p>
                        <p>
                          <strong>Identity:</strong> {candidate.identityReviewState} ·{" "}
                          {formatScore(candidate.identityConfidence)}
                        </p>
                        <p>
                          <strong>Resolved identity:</strong> {candidate.name}
                          {candidate.domain ? ` · ${candidate.domain}` : ""}
                        </p>
                        <p>
                          <strong>First-party evidence:</strong>{" "}
                          {candidate.provenance.firstParty
                            ? (candidate.provenance.sourceTitle ??
                              "Confirmed source page")
                            : "No first-party discovery source recorded"}
                        </p>
                      </section>
                      <section>
                        <h3>Factors and evidence</h3>
                        <ul className={styles.factorList}>
                          {candidate.factors.map((factor) => (
                            <li key={factor.key}>
                              <strong>
                                {factor.key}: {factor.state} ({formatScore(factor.value)})
                              </strong>
                              <div>{factor.explanation}</div>
                              {factor.missingEvidence.length ? (
                                <div className={styles.muted}>
                                  Missing: {factor.missingEvidence.join(", ")}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {candidate.unresolvedQuestions.length ? (
                          <p>
                            <strong>Unresolved:</strong>{" "}
                            {candidate.unresolvedQuestions.join(", ")}
                          </p>
                        ) : null}
                      </section>
                      <section>
                        <h3>Campaign review</h3>
                        <div className={styles.actions}>
                          <Button
                            disabled={pending}
                            onClick={() => decide(candidate, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            disabled={pending}
                            onClick={() => decide(candidate, "research_requested")}
                          >
                            More research
                          </Button>
                          <Button
                            disabled={pending}
                            onClick={() => decide(candidate, "rejected")}
                          >
                            Reject
                          </Button>
                          <Button
                            disabled={pending}
                            onClick={() => decide(candidate, "excluded")}
                          >
                            Exclude
                          </Button>
                        </div>
                        <form
                          className={styles.reviewForm}
                          action={(formData) =>
                            decide(candidate, "conditional", formData)
                          }
                        >
                          <label>
                            Condition
                            <input name="condition" required />
                          </label>
                          <label>
                            Reason
                            <textarea name="reason" />
                          </label>
                          <Button disabled={pending} type="submit">
                            Mark conditional
                          </Button>
                        </form>
                        <h3>Propose correction</h3>
                        <form
                          className={styles.reviewForm}
                          action={(formData) => correct(candidate, formData)}
                        >
                          <label>
                            Classification
                            <select name="correctionType" defaultValue="relationship">
                              <option value="relationship">Relationship</option>
                              <option value="archetype">Archetype</option>
                              <option value="entity">Entity or duplicate</option>
                              <option value="evidence">Evidence</option>
                              <option value="procurement">Procurement</option>
                              <option value="location">Location</option>
                            </select>
                          </label>
                          <label>
                            Correct value
                            <input name="proposedValue" required />
                          </label>
                          <label>
                            Reason
                            <textarea name="correctionReason" required />
                          </label>
                          <label>
                            Memory scope
                            <select name="scope" defaultValue="campaign">
                              <option value="candidate">This candidate</option>
                              <option value="campaign">This campaign</option>
                              <option value="offering">This offering</option>
                              <option value="workspace">Workspace</option>
                            </select>
                          </label>
                          <Button disabled={pending} type="submit">
                            Record correction
                          </Button>
                        </form>
                        <p className={styles.muted}>
                          Corrections are audited proposals. They do not silently rewrite
                          the frozen evaluation. Recorded corrections:{" "}
                          {candidate.correctionCount}.
                        </p>
                      </section>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? (
        <p>No evaluated candidates in this view match the current search.</p>
      ) : null}
    </section>
  );
}

function laneTone(lane: ResultLane) {
  if (lane === "recommended") return "success" as const;
  if (lane === "conditional" || lane === "needs_research") return "warning" as const;
  if (lane === "rejected" || lane === "excluded") return "danger" as const;
  return "neutral" as const;
}

function formatScore(value: number | null) {
  if (value === null) return "Not enough data";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  applyGuidedProposalAction,
  interpretGuidedRequestAction,
} from "@/server/guided/actions";
import type { AiGuidedResponse } from "@/lib/guided/contracts";
import styles from "./Guided.module.css";

export function ContextualAiDrawer({
  context,
  scope,
  entityId,
  baseVersion,
  actions,
}: {
  context: string;
  scope: "company" | "campaign";
  entityId: string;
  baseVersion: number;
  actions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [response, setResponse] = useState<AiGuidedResponse | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState("");
  const [pending, startTransition] = useTransition();
  function interpret() {
    startTransition(async () => {
      setError("");
      try {
        setResponse(await interpretGuidedRequestAction({ scope, entityId, request }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not interpret request.");
      }
    });
  }
  function apply() {
    if (!response?.proposedChanges?.length) return;
    startTransition(async () => {
      setError("");
      try {
        const result = await applyGuidedProposalAction({
          scope,
          entityId,
          baseVersion,
          changes: response.proposedChanges ?? [],
        });
        setApplied(result.message);
        setResponse(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not apply proposal.");
      }
    });
  }
  return (
    <div className={styles.drawerDock}>
      <Button type="button" variant="ghost" onClick={() => setOpen((value) => !value)}>
        {open ? "Close Ask Opptium" : "Ask Opptium"}
      </Button>
      {open ? (
        <aside className={styles.drawer} aria-label={`Ask Opptium about ${context}`}>
          <header>
            <span className={styles.eyebrow}>Ask Opptium about</span>
            <strong>{context}</strong>
          </header>
          <div className={styles.quickActions}>
            {actions.map((action) => (
              <button type="button" key={action} onClick={() => setRequest(action)}>
                {action}
              </button>
            ))}
          </div>
          <label>
            <span>Describe an adjustment</span>
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Explain what should change. Opptium will propose structured changes for review."
            />
          </label>
          <p className={styles.note}>
            Suggestions are not saved until you review and apply the structured change.
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}
          {applied ? <p className={styles.success}>{applied}</p> : null}
          {response ? (
            <div className={styles.proposal}>
              <strong>{response.summaryCard?.title ?? "Proposed interpretation"}</strong>
              <p>{response.message}</p>
              {response.summaryCard?.items.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>
                    {Array.isArray(item.value) ? item.value.join(", ") : item.value}
                  </strong>
                </div>
              ))}
              {response.question ? <p>{response.question.title}</p> : null}
              {response.proposedChanges?.length ? (
                <div className={styles.proposalActions}>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={apply}
                    disabled={pending}
                  >
                    Apply changes
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setResponse(null)}>
                    Adjust
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <Button type="button" disabled={!request.trim() || pending} onClick={interpret}>
            {pending ? "Interpreting…" : "Interpret request"}
          </Button>
        </aside>
      ) : null}
    </div>
  );
}

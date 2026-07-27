import type { ReactNode } from "react";
import styles from "./Guided.module.css";

export function AiGuidedWorkspace({
  context,
  currentStep,
  totalSteps,
  children,
  summary,
}: {
  context: string;
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
  summary: ReactNode;
}) {
  const progress = Math.round((currentStep / Math.max(totalSteps, 1)) * 100);
  return (
    <section className={styles.workspace} aria-label={`Guided setup: ${context}`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Setting up</span>
          <strong>{context}</strong>
        </div>
        <span>
          Step {currentStep} of {totalSteps}
        </span>
        <div className={styles.progress} aria-label={`${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>
      <div className={styles.columns}>
        <div className={styles.decision}>{children}</div>
        <aside className={styles.summary} aria-label="Live structured summary">
          <span className={styles.eyebrow}>Live structured summary</span>
          {summary}
        </aside>
      </div>
    </section>
  );
}

export function GuidedOptionCard({
  children,
  description,
  recommended,
}: {
  children: ReactNode;
  description?: string;
  recommended?: boolean;
}) {
  return (
    <span className={styles.optionContent}>
      <span>
        {children} {recommended ? <small>Recommended</small> : null}
      </span>
      {description ? <small>{description}</small> : null}
    </span>
  );
}

export function GuidedStatus({
  label,
  value,
  state = "selected",
}: {
  label: string;
  value: string | string[];
  state?: "suggested" | "selected" | "applied" | "saved" | "needs_review";
}) {
  return (
    <div className={styles.statusRow}>
      <span>{label}</span>
      <strong>{Array.isArray(value) ? value.join(", ") || "Not selected" : value}</strong>
      <small data-state={state}>{state.replace("_", " ")}</small>
    </div>
  );
}

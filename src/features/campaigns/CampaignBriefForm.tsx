"use client";

import { useMemo, useState, useTransition } from "react";
import type { CompanyProfile } from "@/types/domain";
import { createCampaignAction } from "@/server/campaigns/actions";
import {
  interpretCampaignDraftRequestAction,
  saveGuidedDraftAction,
} from "@/server/guided/actions";
import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import shared from "@/features/shared/Feature.module.css";
import {
  AiGuidedWorkspace,
  GuidedOptionCard,
  GuidedStatus,
} from "@/features/guided/AiGuidedWorkspace";
import type { GuidedDraft } from "@/server/guided/repository";
import type { AiGuidedResponse } from "@/lib/guided/contracts";
import styles from "./CampaignGuided.module.css";

const goals = [
  [
    "customers",
    "Find customers for this offering",
    "Prioritise likely buyers with a relevant commercial need.",
  ],
  ["market", "Enter a new market", "Find an initial segment in a selected geography."],
  [
    "distributors",
    "Find distributors",
    "Target companies with route-to-market capability.",
  ],
  [
    "licensing",
    "Find licensing partners",
    "Identify commercially relevant licensing counterparties.",
  ],
  ["partners", "Find strategic partners", "Explore bounded partnership opportunities."],
  ["manufacturing", "Find manufacturing partners", "Find suitable production partners."],
  ["suppliers", "Find suppliers", "Identify suppliers for a defined commercial need."],
  ["reengage", "Re-engage a known segment", "Refine a previously targeted audience."],
] as const;

type DraftState = {
  offeringId: string;
  goal: string;
  relationshipType: string;
  name: string;
  segment: string;
  markets: string;
  personas: string;
  qualification: string;
  exclusions: string;
  discoveryStrategy: string;
  desiredLeadCount: number;
  language: string;
};

export function CampaignBriefForm({
  error,
  profile,
  initialDraft,
}: {
  error?: string;
  profile: CompanyProfile;
  initialDraft: GuidedDraft | null;
}) {
  const offerings =
    profile.structuredProfile?.offerings.filter((item) => item.status !== "excluded") ??
    [];
  const saved = initialDraft?.draftData as Partial<DraftState> | undefined;
  const [step, setStep] = useState(Number(initialDraft?.currentStep) || 1);
  const [draft, setDraft] = useState<DraftState>({
    offeringId: saved?.offeringId ?? offerings[0]?.id ?? "",
    goal: saved?.goal ?? "customers",
    relationshipType: saved?.relationshipType ?? "Customer",
    name: saved?.name ?? "",
    segment: saved?.segment ?? "",
    markets:
      saved?.markets ?? profile.structuredProfile?.prospectingMarkets.join(", ") ?? "",
    personas: saved?.personas ?? "",
    qualification: saved?.qualification ?? "",
    exclusions: saved?.exclusions ?? "",
    discoveryStrategy: saved?.discoveryStrategy ?? "",
    desiredLeadCount: saved?.desiredLeadCount ?? 25,
    language:
      saved?.language ?? profile.structuredProfile?.outreachLanguages[0] ?? "English",
  });
  const [custom, setCustom] = useState("");
  const [proposal, setProposal] = useState<AiGuidedResponse | null>(null);
  const [interpretationError, setInterpretationError] = useState("");
  const [saving, startSaving] = useTransition();
  const offering = offerings.find((item) => item.id === draft.offeringId);
  const objective = goals.find(([id]) => id === draft.goal)?.[1] ?? draft.goal;
  const totalSteps = 10;

  const completed = useMemo(
    () => Array.from({ length: Math.max(step - 1, 0) }, (_, index) => String(index + 1)),
    [step],
  );

  function advance(next: number) {
    const bounded = Math.min(totalSteps, Math.max(1, next));
    setStep(bounded);
    startSaving(async () => {
      await saveGuidedDraftAction({
        scope: "campaign",
        entityId: "new",
        baseVersion: profile.version,
        currentStep: String(bounded),
        completedSteps: completed,
        draftData: draft,
        status: bounded === totalSteps ? "ready" : "draft",
      });
    });
  }

  function interpretCustom() {
    startSaving(async () => {
      setInterpretationError("");
      try {
        setProposal(
          await interpretCampaignDraftRequestAction({
            request: custom,
            draftData: draft,
          }),
        );
      } catch (cause) {
        setInterpretationError(
          cause instanceof Error ? cause.message : "Could not interpret request.",
        );
      }
    });
  }

  function applyProposal() {
    const next = { ...draft };
    for (const change of proposal?.proposedChanges ?? []) {
      const value = Array.isArray(change.proposedValue)
        ? change.proposedValue.join(", ")
        : String(change.proposedValue ?? "");
      if (change.fieldPath === "targetGeography") next.markets = value;
      else if (change.fieldPath === "companyTypes") next.segment = value;
      else if (change.fieldPath === "contactRoles") next.personas = value;
      else if (change.fieldPath === "qualificationCriteria") next.qualification = value;
      else if (change.fieldPath === "exclusions") next.exclusions = value;
    }
    setDraft(next);
    setProposal(null);
    setCustom("");
  }

  return (
    <AiGuidedWorkspace
      context={`Campaign — ${offering?.name ?? "Select an offering"}`}
      currentStep={step}
      totalSteps={totalSteps}
      summary={
        <>
          <GuidedStatus
            label="Relationship"
            value={draft.relationshipType}
            state={draft.relationshipType ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Offering"
            value={offering?.name ?? "Not selected"}
            state={draft.offeringId ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Goal"
            value={objective}
            state={draft.goal ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Customer segment"
            value={draft.segment || "Not confirmed"}
            state={draft.segment ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Markets"
            value={split(draft.markets)}
            state={draft.markets ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Buyer personas"
            value={split(draft.personas)}
            state={draft.personas ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Qualification"
            value={split(draft.qualification)}
            state={draft.qualification ? "selected" : "needs_review"}
          />
        </>
      }
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {step === 1 ? (
        <Decision
          title="Which offering should this campaign promote?"
          description="Campaign overrides will not change the master Company Profile."
        >
          <div className={styles.options}>
            {offerings.map((item, index) => (
              <label key={item.id} className={styles.option}>
                <input
                  type="radio"
                  checked={draft.offeringId === item.id}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      offeringId: item.id,
                      segment: item.targetCustomerTypes.join(", "),
                      personas: item.buyerPersonas.map((p) => p.titleGroup).join(", "),
                      qualification: item.qualificationRequirements.join("\n"),
                    })
                  }
                />
                <GuidedOptionCard
                  description={item.shortDescription}
                  recommended={index === 0}
                >
                  {item.name}
                </GuidedOptionCard>
              </label>
            ))}
          </div>
        </Decision>
      ) : null}
      {step === 2 ? (
        <Decision
          title="What do you want to achieve?"
          description="Choose the closest commercial objective; you can describe a custom one below."
        >
          <div className={styles.options}>
            {goals.map(([id, label, description], index) => (
              <label key={id} className={styles.option}>
                <input
                  type="radio"
                  checked={draft.goal === id}
                  onChange={() => setDraft({ ...draft, goal: id })}
                />
                <GuidedOptionCard description={description} recommended={index === 0}>
                  {label}
                </GuidedOptionCard>
              </label>
            ))}
          </div>
        </Decision>
      ) : null}
      {step === 3 ? (
        <TextDecision
          title="What commercial relationship are you seeking?"
          label="Relationship type"
          value={draft.relationshipType}
          onChange={(relationshipType) => setDraft({ ...draft, relationshipType })}
          placeholder="Customer, distributor, licensing partner"
        />
      ) : null}
      {step === 4 ? (
        <TextDecision
          title="Which markets should this campaign target?"
          label="Campaign markets"
          value={draft.markets}
          onChange={(markets) => setDraft({ ...draft, markets })}
          placeholder="Germany, France, Italy"
        />
      ) : null}
      {step === 5 ? (
        <TextDecision
          title="Review the suggested customer segment"
          label="Target customer segment"
          value={draft.segment}
          onChange={(segment) => setDraft({ ...draft, segment })}
          placeholder="Mid-sized pharmaceutical brands needing external manufacturing"
        />
      ) : null}
      {step === 6 ? (
        <TextDecision
          title="Who owns or influences this decision?"
          label="Buyer personas"
          value={draft.personas}
          onChange={(personas) => setDraft({ ...draft, personas })}
          placeholder="Procurement, Supply Chain, Business Development"
        />
      ) : null}
      {step === 7 ? (
        <TextDecision
          title="What makes a company qualified?"
          label="One criterion per line"
          value={draft.qualification}
          onChange={(qualification) => setDraft({ ...draft, qualification })}
          placeholder="Relevant product portfolio\nEvidence of outsourced production"
          multiline
        />
      ) : null}
      {step === 8 ? (
        <TextDecision
          title="Which companies should be excluded?"
          label="Exclusions"
          value={draft.exclusions}
          onChange={(exclusions) => setDraft({ ...draft, exclusions })}
          placeholder="Exclude startups\nPrefer evidence of EU market activity"
          multiline
        />
      ) : null}
      {step === 9 ? (
        <TextDecision
          title="Review the discovery strategy"
          label="What Opptium should search for"
          value={draft.discoveryStrategy}
          onChange={(discoveryStrategy) => setDraft({ ...draft, discoveryStrategy })}
          placeholder="Find established companies matching the segment, market, relationship, and qualification rules."
          multiline
        />
      ) : null}
      {step === 10 ? (
        <Decision
          title="Create this campaign"
          description="Review the live structured summary. The selected offering and overrides are frozen into the campaign; the master profile is unchanged."
        >
          <form action={createCampaignAction} className={shared.stack}>
            <label className={form.field}>
              <span>Campaign name</span>
              <input
                className={form.input}
                name="name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </label>
            <input type="hidden" name="selectedOfferingId" value={draft.offeringId} />
            <input type="hidden" name="objective" value={objective} />
            <input type="hidden" name="relationshipType" value={draft.relationshipType} />
            <input type="hidden" name="targetSegments" value={draft.segment} />
            <input
              type="hidden"
              name="geography"
              value={draft.markets || "Any relevant market"}
            />
            <input
              type="hidden"
              name="qualificationCriteria"
              value={draft.qualification}
            />
            <input type="hidden" name="exclusions" value={draft.exclusions} />
            <input type="hidden" name="language" value={draft.language} />
            <input type="hidden" name="desiredLeadCount" value={draft.desiredLeadCount} />
            <input
              type="hidden"
              name="terms"
              value={`${offering?.name ?? "offering"}, ${draft.segment}`}
            />
            <input
              type="hidden"
              name="sourceCategories"
              value="Company websites, public business directories, trade associations"
            />
            <input
              type="hidden"
              name="offeringOverrides"
              value={JSON.stringify({
                goal: draft.goal,
                relationshipType: draft.relationshipType,
                buyerPersonas: split(draft.personas),
                markets: split(draft.markets),
                qualificationCriteria: split(draft.qualification),
                exclusions: split(draft.exclusions),
                discoveryStrategy: draft.discoveryStrategy,
              })}
            />
            <label className={form.field}>
              <span>
                <input type="checkbox" name="saveAsOfferingDefaults" value="yes" /> Save
                buyer personas, qualification, exclusions, and markets as defaults for
                future campaigns using this offering
              </span>
            </label>
            <input type="hidden" name="buyerPersonas" value={draft.personas} />
            <Button type="submit" variant="primary">
              Create campaign
            </Button>
          </form>
        </Decision>
      ) : null}
      {step < 10 ? (
        <div className={styles.customComposer}>
          <label className={form.field}>
            <span>Something else or explain it in your own words</span>
            <input
              className={form.input}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="Describe an unusual requirement"
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            disabled={!custom.trim() || saving}
            onClick={interpretCustom}
          >
            Interpret
          </Button>
          {interpretationError ? (
            <p className={styles.error}>{interpretationError}</p>
          ) : null}
          {proposal ? (
            <div className={styles.proposal}>
              <strong>{proposal.summaryCard?.title ?? "I interpreted this as"}</strong>
              <p>{proposal.message}</p>
              {proposal.summaryCard?.items.map((item) => (
                <p key={item.label}>
                  <span>{item.label}</span>
                  <strong>
                    {Array.isArray(item.value) ? item.value.join(", ") : item.value}
                  </strong>
                </p>
              ))}
              {proposal.question ? <p>{proposal.question.title}</p> : null}
              {proposal.proposedChanges?.length ? (
                <div className={styles.navigation}>
                  <Button type="button" variant="primary" onClick={applyProposal}>
                    Apply changes
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setProposal(null)}>
                    Adjust
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={styles.navigation}>
        <Button
          type="button"
          variant="ghost"
          disabled={step === 1 || saving}
          onClick={() => advance(step - 1)}
        >
          Back
        </Button>
        {step < 10 ? (
          <Button
            type="button"
            variant="primary"
            disabled={saving || (step === 1 && !draft.offeringId)}
            onClick={() => advance(step + 1)}
          >
            {saving ? "Saving…" : "Continue"}
          </Button>
        ) : null}
      </div>
    </AiGuidedWorkspace>
  );
}

function Decision({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </>
  );
}
function TextDecision({
  title,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <Decision
      title={title}
      description="Opptium proposed this from the selected offering. Adjust it directly or explain a custom requirement."
    >
      <label className={form.field}>
        <span>{label}</span>
        {multiline ? (
          <textarea
            className={form.textarea}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            className={form.input}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
        )}
      </label>
    </Decision>
  );
}
function split(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

"use client";

import { useMemo, useState } from "react";
import { createCampaignAction } from "@/server/campaigns/actions";
import type { Offer } from "@/types/domain";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

const steps = ["Select offer", "Define market", "Ideal companies", "Review strategy"];

type CampaignDraft = {
  desiredLeadCount: string;
  exclusions: string;
  geography: string;
  industryTerms: string;
  language: string;
  localizedTerms: string;
  name: string;
  objective: string;
  offerId: string;
  qualificationCriteria: string;
  sourceCategories: string;
  targetSegments: string;
  terms: string;
};

const initialDraft: CampaignDraft = {
  desiredLeadCount: "40",
  exclusions: "Retail-only sellers; prototype-only hobby shops",
  geography: "Sweden and Denmark",
  industryTerms: "Factory automation, industrial equipment, production systems",
  language: "English",
  localizedTerms: "maskinkomponenter, industrikomponenter, underleverandor",
  name: "Nordic equipment builders",
  objective: "Direct buyers",
  offerId: "",
  qualificationCriteria:
    "Equipment production, recurring component needs, visible contact route",
  sourceCategories: "Company sites, industry directories, association lists",
  targetSegments: "Equipment manufacturers, automation integrators",
  terms: "custom machined parts, OEM component supplier, automation equipment",
};

export function CampaignWizard({
  error,
  offers,
}: Readonly<{ error?: string; offers: Offer[] }>) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignDraft>({
    ...initialDraft,
    offerId: offers[0]?.id ?? "",
  });
  const currentStep = steps[step] ?? "Select offer";
  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === draft.offerId),
    [draft.offerId, offers],
  );

  function updateField(key: keyof CampaignDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <Card>
      <CardHeader
        title={currentStep}
        eyebrow="Campaign wizard"
        action={
          <Badge tone="accent">
            Step {step + 1} of {steps.length}
          </Badge>
        }
      />
      <form action={createCampaignAction} className={styles.cardBody}>
        <HiddenFields draft={draft} />
        <ol className={styles.pillList} aria-label="Campaign wizard steps">
          {steps.map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>

        <div className={styles.stack} style={{ marginTop: "var(--space-5)" }}>
          {error ? <p className={styles.secondaryText}>{error}</p> : null}
          {step === 0 ? (
            <OfferStep draft={draft} offers={offers} updateField={updateField} />
          ) : null}
          {step === 1 ? <MarketStep draft={draft} updateField={updateField} /> : null}
          {step === 2 ? <CompanyStep draft={draft} updateField={updateField} /> : null}
          {step === 3 ? (
            <StrategyStep
              draft={draft}
              selectedOfferName={selectedOffer?.name}
              updateField={updateField}
            />
          ) : null}
          <div className={styles.filters}>
            <Button
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                disabled={offers.length === 0}
                variant="primary"
                onClick={() => setStep((value) => value + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button disabled={offers.length === 0} variant="primary" type="submit">
                Create campaign
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}

function HiddenFields({ draft }: Readonly<{ draft: CampaignDraft }>) {
  return (
    <>
      {Object.entries(draft).map(([key, value]) => (
        <input key={key} name={key} type="hidden" value={value} />
      ))}
    </>
  );
}

function OfferStep({
  draft,
  offers,
  updateField,
}: Readonly<{
  draft: CampaignDraft;
  offers: Offer[];
  updateField: (key: keyof CampaignDraft, value: string) => void;
}>) {
  return (
    <>
      <label className={form.field} htmlFor="campaign-offer">
        <span>Selected offer</span>
        <select
          className={form.select}
          id="campaign-offer"
          value={draft.offerId}
          onChange={(event) => updateField("offerId", event.target.value)}
        >
          {offers.length === 0 ? (
            <option value="">Create or load an offer first</option>
          ) : null}
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.name}
            </option>
          ))}
        </select>
      </label>
      {offers.length === 0 ? (
        <p className={styles.secondaryText}>
          Create or load an offer before creating a campaign.
        </p>
      ) : null}
    </>
  );
}

function MarketStep({
  draft,
  updateField,
}: Readonly<{
  draft: CampaignDraft;
  updateField: (key: keyof CampaignDraft, value: string) => void;
}>) {
  return (
    <>
      <TextInput
        label="Campaign name"
        name="name"
        value={draft.name}
        onChange={(value) => updateField("name", value)}
      />
      <label className={form.field} htmlFor="objective">
        <span>Campaign objective</span>
        <select
          className={form.select}
          id="objective"
          value={draft.objective}
          onChange={(event) => updateField("objective", event.target.value)}
        >
          <option value="Direct buyers">Direct buyers</option>
          <option value="Distributors">Distributors</option>
          <option value="Partners">Partners</option>
          <option value="Subcontracting clients">Subcontracting clients</option>
        </select>
      </label>
      <TextInput
        label="Country or region"
        name="geography"
        value={draft.geography}
        onChange={(value) => updateField("geography", value)}
      />
      <TextInput
        label="Campaign language"
        name="language"
        value={draft.language}
        onChange={(value) => updateField("language", value)}
      />
    </>
  );
}

function CompanyStep({
  draft,
  updateField,
}: Readonly<{
  draft: CampaignDraft;
  updateField: (key: keyof CampaignDraft, value: string) => void;
}>) {
  return (
    <>
      <Textarea
        label="Preferred company types"
        name="targetSegments"
        value={draft.targetSegments}
        onChange={(value) => updateField("targetSegments", value)}
      />
      <Textarea
        label="Industries"
        name="industryTerms"
        value={draft.industryTerms}
        onChange={(value) => updateField("industryTerms", value)}
      />
      <Textarea
        label="Exclusions"
        name="exclusions"
        value={draft.exclusions}
        onChange={(value) => updateField("exclusions", value)}
      />
      <TextInput
        label="Desired lead count"
        name="desiredLeadCount"
        type="number"
        value={draft.desiredLeadCount}
        onChange={(value) => updateField("desiredLeadCount", value)}
      />
    </>
  );
}

function StrategyStep({
  draft,
  selectedOfferName,
  updateField,
}: Readonly<{
  draft: CampaignDraft;
  selectedOfferName?: string;
  updateField: (key: keyof CampaignDraft, value: string) => void;
}>) {
  return (
    <div className={styles.stack}>
      <p className={styles.secondaryText}>
        Creating campaign for {selectedOfferName ?? "selected offer"}.
      </p>
      <Textarea
        label="Search terminology"
        name="terms"
        value={draft.terms}
        onChange={(value) => updateField("terms", value)}
      />
      <Textarea
        label="Local-language terms"
        name="localizedTerms"
        value={draft.localizedTerms}
        onChange={(value) => updateField("localizedTerms", value)}
      />
      <Textarea
        label="Expected sources"
        name="sourceCategories"
        value={draft.sourceCategories}
        onChange={(value) => updateField("sourceCategories", value)}
      />
      <Textarea
        label="Qualification criteria"
        name="qualificationCriteria"
        value={draft.qualificationCriteria}
        onChange={(value) => updateField("qualificationCriteria", value)}
      />
    </div>
  );
}

function TextInput({
  label,
  name,
  onChange,
  type = "text",
  value,
}: Readonly<{
  label: string;
  name: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  value: string;
}>) {
  return (
    <label className={form.field} htmlFor={name}>
      <span>{label}</span>
      <input
        className={form.input}
        id={name}
        min={type === "number" ? 1 : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function Textarea({
  label,
  name,
  onChange,
  value,
}: Readonly<{
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}>) {
  return (
    <label className={form.field} htmlFor={name}>
      <span>{label}</span>
      <textarea
        className={form.textarea}
        id={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

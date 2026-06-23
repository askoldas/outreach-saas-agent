"use client";

import { useMemo, useState } from "react";
import { createCampaignAction, updateCampaignAction } from "@/server/campaigns/actions";
import type { Campaign, Offer } from "@/types/domain";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "@/features/shared/Feature.module.css";

const steps = [
  "Select offer",
  "Define market",
  "Ideal companies",
  "Search strategy",
  "Review & save",
];

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
  desiredLeadCount: "25",
  exclusions: "",
  geography: "",
  industryTerms: "",
  language: "English",
  localizedTerms: "",
  name: "",
  objective: "Direct buyers",
  offerId: "",
  qualificationCriteria: "",
  sourceCategories: "",
  targetSegments: "",
  terms: "",
};

export function CampaignWizard({
  campaign,
  error,
  mode = "create",
  offers,
}: Readonly<{
  campaign?: Campaign;
  error?: string;
  mode?: "create" | "edit";
  offers: Offer[];
}>) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    campaign
      ? mapCampaignToDraft(campaign)
      : {
          ...initialDraft,
          offerId: offers[0]?.id ?? "",
        },
  );
  const currentStep = steps[step] ?? "Select offer";
  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === draft.offerId),
    [draft.offerId, offers],
  );

  function updateField(key: keyof CampaignDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function canContinue() {
    if (offers.length === 0) return false;
    if (step === 0) return Boolean(draft.offerId);
    if (step === 1) return Boolean(draft.name.trim() && draft.geography.trim());
    if (step === 2) return Boolean(draft.targetSegments.trim());
    if (step === 3) return Boolean(draft.terms.trim() || draft.localizedTerms.trim());
    if (step === 4) return Boolean(draft.terms.trim() || draft.localizedTerms.trim());
    return true;
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
      <form
        action={mode === "edit" ? updateCampaignAction : createCampaignAction}
        className={styles.cardBody}
      >
        {campaign ? <input name="campaignId" type="hidden" value={campaign.id} /> : null}
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
          {step === 4 ? (
            <ReviewStep draft={draft} selectedOfferName={selectedOffer?.name} />
          ) : null}
          <div className={styles.filters}>
            <Button
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              type="button"
            >
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                disabled={!canContinue()}
                variant="primary"
                onClick={() => setStep((value) => value + 1)}
                type="button"
              >
                Continue
              </Button>
            ) : (
              <Button disabled={!canContinue()} variant="primary" type="submit">
                {mode === "edit" ? "Save campaign" : "Create campaign"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}

function mapCampaignToDraft(campaign: Campaign): CampaignDraft {
  return {
    desiredLeadCount: String(campaign.desiredLeadCount || 25),
    exclusions: campaign.strategy.exclusions.join(", "),
    geography: campaign.geography,
    industryTerms: campaign.industryTerms.join(", "),
    language: campaign.language,
    localizedTerms: campaign.strategy.localizedTerms.join(", "),
    name: campaign.name,
    objective: campaign.objective,
    offerId: campaign.offerId,
    qualificationCriteria: campaign.strategy.criteria.join(", "),
    sourceCategories: campaign.strategy.sources.join(", "),
    targetSegments: campaign.targetSegments.join(", "),
    terms: campaign.strategy.terms.join(", "),
  };
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
        placeholder="Italy pharmacy distributors"
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
        placeholder="Italy"
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
        placeholder="Pharmacy groups, para-pharmacies, pharmaceutical distributors"
        value={draft.targetSegments}
        onChange={(value) => updateField("targetSegments", value)}
      />
      <Textarea
        label="Industries"
        name="industryTerms"
        placeholder="Pharmaceutical wholesale, pharmacy supplies, medical devices"
        value={draft.industryTerms}
        onChange={(value) => updateField("industryTerms", value)}
      />
      <Textarea
        label="Exclusions"
        name="exclusions"
        placeholder="Blogs, job boards, marketplaces, unrelated informational sites"
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
        placeholder="farmacia online, parafarmacia, grossista farmaceutico"
        value={draft.terms}
        onChange={(value) => updateField("terms", value)}
      />
      <Textarea
        label="Local-language terms"
        name="localizedTerms"
        placeholder="forniture farmacia, distributore farmaceutico, prodotti sanitari"
        value={draft.localizedTerms}
        onChange={(value) => updateField("localizedTerms", value)}
      />
      <Textarea
        label="Expected sources"
        name="sourceCategories"
        placeholder="Company websites, contact pages, distributor lists"
        value={draft.sourceCategories}
        onChange={(value) => updateField("sourceCategories", value)}
      />
      <Textarea
        label="Qualification criteria"
        name="qualificationCriteria"
        placeholder="Actual operating company, relevant geography, visible contact route"
        value={draft.qualificationCriteria}
        onChange={(value) => updateField("qualificationCriteria", value)}
      />
    </div>
  );
}

function ReviewStep({
  draft,
  selectedOfferName,
}: Readonly<{ draft: CampaignDraft; selectedOfferName?: string }>) {
  return (
    <div className={styles.stack}>
      <p className={styles.secondaryText}>
        Review this campaign before saving. Use Back to edit any section.
      </p>
      <SummaryBlock
        title="Offer and market"
        items={[
          selectedOfferName ?? "No offer selected",
          draft.name,
          draft.objective,
          draft.geography,
          draft.language,
        ]}
      />
      <SummaryBlock
        title="Ideal companies"
        items={[
          ...toList(draft.targetSegments),
          ...toList(draft.industryTerms),
          ...toList(draft.exclusions).map((item) => `Exclude: ${item}`),
        ]}
      />
      <SummaryBlock
        title="Search strategy"
        items={[
          ...toList(draft.terms),
          ...toList(draft.localizedTerms),
          ...toList(draft.sourceCategories).map((item) => `Source: ${item}`),
          ...toList(draft.qualificationCriteria).map((item) => `Criteria: ${item}`),
        ]}
      />
    </div>
  );
}

function SummaryBlock({ items, title }: Readonly<{ items: string[]; title: string }>) {
  const visibleItems = items.map((item) => item.trim()).filter(Boolean);

  return (
    <section className={styles.stack}>
      <h2 className={styles.primaryText}>{title}</h2>
      {visibleItems.length > 0 ? (
        <ul className={styles.pillList}>
          {visibleItems.map((item, index) => (
            <li key={`${title}-${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.secondaryText}>No values entered.</p>
      )}
    </section>
  );
}

function TextInput({
  label,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}: Readonly<{
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
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
  placeholder,
  value,
}: Readonly<{
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}>) {
  return (
    <label className={form.field} htmlFor={name}>
      <span>{label}</span>
      <textarea
        className={form.textarea}
        id={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function toList(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

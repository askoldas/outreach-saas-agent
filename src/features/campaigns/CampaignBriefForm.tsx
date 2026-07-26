"use client";

import { useMemo, useState, useTransition } from "react";
import type { CompanyProfile } from "@/types/domain";
import {
  createCampaignAction,
  proposeCampaignBriefAction,
} from "@/server/campaigns/actions";
import type {
  CampaignBriefProposal,
  ConfirmedCampaignBrief,
} from "@/lib/campaign-workflow/contracts";
import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import shared from "@/features/shared/Feature.module.css";
import {
  AiGuidedWorkspace,
  GuidedOptionCard,
  GuidedStatus,
} from "@/features/guided/AiGuidedWorkspace";
import type { GuidedDraft } from "@/server/guided/repository";
import styles from "./CampaignGuided.module.css";

const regions = [
  { label: "DACH", codes: ["DE", "AT", "CH"] },
  { label: "Nordics", codes: ["DK", "FI", "IS", "NO", "SE"] },
  { label: "Baltics", codes: ["EE", "LV", "LT"] },
  { label: "Benelux", codes: ["BE", "NL", "LU"] },
  {
    label: "European Union",
    codes: [
      "AT",
      "BE",
      "BG",
      "HR",
      "CY",
      "CZ",
      "DK",
      "EE",
      "FI",
      "FR",
      "DE",
      "GR",
      "HU",
      "IE",
      "IT",
      "LV",
      "LT",
      "LU",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SK",
      "SI",
      "ES",
      "SE",
    ],
  },
  { label: "Worldwide", codes: ["WORLDWIDE"] },
] as const;

type ProposalResult = Awaited<ReturnType<typeof proposeCampaignBriefAction>>;

export function CampaignBriefForm({
  error,
  profile,
}: {
  error?: string;
  profile: CompanyProfile;
  initialDraft: GuidedDraft | null;
}) {
  const [step, setStep] = useState(1);
  const [countryInput, setCountryInput] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [proposal, setProposal] = useState<CampaignBriefProposal | null>(null);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [name, setName] = useState("");
  const [offeringTitle, setOfferingTitle] = useState("");
  const [offeringSummary, setOfferingSummary] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [targetSummary, setTargetSummary] = useState("");
  const [companyTypes, setCompanyTypes] = useState("");
  const [industries, setIndustries] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [positiveSignals, setPositiveSignals] = useState("");
  const [requiredCriteria, setRequiredCriteria] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [roles, setRoles] = useState("");
  const [desiredQualifiedCompanies, setDesiredQualifiedCompanies] = useState(25);
  const [proposalError, setProposalError] = useState("");
  const [pending, startTransition] = useTransition();

  const geographyLabel = regionLabel || countryCodes.join(", ");
  const targetClientIssue = !targetSummary.trim()
    ? "Add a target-client summary to continue."
    : !split(companyTypes).length
      ? "Add at least one company type to continue."
      : proposal?.ambiguity?.requiresClarification && !clarificationAnswer.trim()
        ? "Answer the clarification above to continue."
        : "";
  const confirmedBrief = useMemo<ConfirmedCampaignBrief | null>(() => {
    if (!proposal) return null;
    return {
      geography: {
        countryCodes,
        ...(regionLabel ? { regionLabel } : {}),
        ...(proposal.geography.primaryLanguage
          ? { primaryLanguage: proposal.geography.primaryLanguage }
          : {}),
      },
      offering: {
        ...proposal.offering,
        profileOfferingIds: selectedOfferingIds,
        title: offeringTitle,
        summary: offeringSummary,
        valueProposition,
      },
      targetClient: {
        ...proposal.targetClient,
        companyTypes: split(companyTypes),
        industries: split(industries),
        characteristics: split(characteristics),
        positiveSignals: split(positiveSignals),
        requiredCriteria: split(requiredCriteria),
        exclusions: split(exclusions),
        recommendedDecisionMakerRoles: split(roles),
        summary: targetSummary,
      },
      desiredQualifiedCompanies,
    };
  }, [
    proposal,
    selectedOfferingIds,
    countryCodes,
    regionLabel,
    offeringTitle,
    offeringSummary,
    valueProposition,
    targetSummary,
    companyTypes,
    industries,
    characteristics,
    positiveSignals,
    requiredCriteria,
    exclusions,
    roles,
    desiredQualifiedCompanies,
  ]);

  function selectRegion(label: string, codes: readonly string[]) {
    setRegionLabel(label);
    setCountryCodes([...codes]);
    setCountryInput("");
    setResult(null);
    setProposal(null);
  }

  function useCustomGeography() {
    const codes = split(countryInput).map((item) => item.toUpperCase());
    setRegionLabel(codes.join(", "));
    setCountryCodes(codes);
    setResult(null);
    setProposal(null);
  }

  function generateProposal() {
    startTransition(async () => {
      setProposalError("");
      try {
        const next = await proposeCampaignBriefAction({ countryCodes, regionLabel });
        setResult(next);
        applyProposal(next.proposal);
        setName(
          `${next.proposal.offering.title} — ${regionLabel || countryCodes.join(", ")}`,
        );
        setStep(2);
      } catch (cause) {
        setProposalError(
          cause instanceof Error
            ? cause.message
            : "Could not prepare the campaign brief.",
        );
      }
    });
  }

  function startWithProfileDefaults() {
    const offerings =
      profile.structuredProfile?.offerings.filter(
        (offering) => offering.status !== "excluded",
      ) ?? [];
    const preferred =
      offerings.find((offering) => offering.priority === "primary") ?? offerings[0];
    if (!preferred) {
      setProposalError("The Company Profile has no campaign-ready offering.");
      return;
    }
    const next = buildProfileDefaultProposal(profile, { countryCodes, regionLabel }, [
      preferred.id,
    ]);
    setResult(null);
    applyProposal(next);
    setName(`${next.offering.title} â€” ${geographyLabel}`);
    setStep(2);
  }

  function applyProposal(next: CampaignBriefProposal) {
    setProposal(next);
    setSelectedOfferingIds(next.offering.profileOfferingIds);
    setClarificationAnswer("");
    setOfferingTitle(next.offering.title);
    setOfferingSummary(next.offering.summary);
    setValueProposition(next.offering.valueProposition);
    setTargetSummary(next.targetClient.summary);
    setCompanyTypes(next.targetClient.companyTypes.join(", "));
    setIndustries(next.targetClient.industries.join(", "));
    setCharacteristics(next.targetClient.characteristics.join("\n"));
    setPositiveSignals(next.targetClient.positiveSignals.join("\n"));
    setRequiredCriteria(next.targetClient.requiredCriteria.join("\n"));
    setExclusions(next.targetClient.exclusions.join("\n"));
    setRoles(next.targetClient.recommendedDecisionMakerRoles.join(", "));
  }

  function selectOffering(offeringId: string, selected: boolean) {
    const ids = selected
      ? Array.from(new Set([...selectedOfferingIds, offeringId]))
      : selectedOfferingIds.filter((id) => id !== offeringId);
    if (!ids.length) {
      setSelectedOfferingIds([]);
      return;
    }
    setResult(null);
    applyProposal(
      buildProfileDefaultProposal(profile, { countryCodes, regionLabel }, ids),
    );
  }

  return (
    <AiGuidedWorkspace
      context={`Campaign — ${profile.companyName}`}
      currentStep={step}
      totalSteps={4}
      summary={
        <>
          <GuidedStatus
            label="Target market"
            value={geographyLabel || "Not selected"}
            state={geographyLabel ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Recommended offering"
            value={offeringTitle || "Generated after market selection"}
            state={offeringTitle ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Recommended target client"
            value={targetSummary || "Generated after market selection"}
            state={targetSummary ? "selected" : "needs_review"}
          />
          <GuidedStatus
            label="Qualified companies wanted"
            value={String(desiredQualifiedCompanies)}
            state="selected"
          />
        </>
      }
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {proposalError ? <p className={styles.error}>{proposalError}</p> : null}

      {step === 1 ? (
        <section className={shared.stack}>
          <div>
            <h2>Where do you want to find companies?</h2>
            <p>
              Geography controls terminology, source selection, language, classification,
              and qualification. Worldwide is used only when selected explicitly.
            </p>
          </div>
          <div className={styles.options}>
            {regions.map((region) => (
              <button
                type="button"
                className={styles.option}
                key={region.label}
                aria-pressed={regionLabel === region.label}
                data-selected={regionLabel === region.label}
                onClick={() => selectRegion(region.label, region.codes)}
              >
                <GuidedOptionCard
                  description={
                    region.codes.length > 8
                      ? "Broad regional market"
                      : region.codes.join(", ")
                  }
                  recommended={false}
                >
                  {region.label}
                </GuidedOptionCard>
              </button>
            ))}
          </div>
          <label className={form.field}>
            <span>Country codes or a custom country group</span>
            <input
              className={form.input}
              value={countryInput}
              onChange={(event) => setCountryInput(event.target.value)}
              placeholder="DE, FR or Germany, Austria"
            />
          </label>
          <div className={styles.navigation}>
            <Button
              type="button"
              variant="ghost"
              disabled={!countryInput.trim()}
              onClick={useCustomGeography}
            >
              Use custom group
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={pending || !countryCodes.length}
              onClick={startWithProfileDefaults}
            >
              Continue with Company Profile defaults
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending || !countryCodes.length}
              onClick={generateProposal}
            >
              {pending ? "Preparing recommendation…" : "Create or adapt target with AI"}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 && proposal ? (
        <section className={shared.stack}>
          <div>
            <h2>Review the recommended offering</h2>
            <p>{proposal.offering.rationale}</p>
          </div>
          <div className={shared.stack}>
            <strong>Select one offering or combine related offerings</strong>
            <p>
              This selection applies only to this campaign. It does not change the Company
              Profile.
            </p>
            <div className={styles.options}>
              {profile.structuredProfile?.offerings
                .filter((offering) => offering.status !== "excluded")
                .map((offering) => (
                  <label className={styles.option} key={offering.id}>
                    <input
                      type="checkbox"
                      checked={selectedOfferingIds.includes(offering.id)}
                      onChange={(event) =>
                        selectOffering(offering.id, event.target.checked)
                      }
                    />
                    <span>
                      <strong>{offering.name}</strong>
                      <br />
                      {offering.shortDescription}
                    </span>
                  </label>
                ))}
            </div>
          </div>
          <Field
            label="Campaign offering"
            value={offeringTitle}
            onChange={setOfferingTitle}
          />
          <Field
            label="Offering summary"
            value={offeringSummary}
            onChange={setOfferingSummary}
            multiline
          />
          <Field
            label="Value proposition"
            value={valueProposition}
            onChange={setValueProposition}
            multiline
          />
          <Navigation
            back={() => setStep(1)}
            next={() => setStep(3)}
            disabled={
              !selectedOfferingIds.length ||
              !offeringTitle.trim() ||
              !offeringSummary.trim() ||
              !valueProposition.trim()
            }
          />
        </section>
      ) : null}

      {step === 3 && proposal ? (
        <section className={shared.stack}>
          <div>
            <h2>Review the recommended target client</h2>
            <p>
              Adjustments apply only to this campaign and never change the Company
              Profile.
            </p>
          </div>
          <Field
            label="Summary"
            value={targetSummary}
            onChange={setTargetSummary}
            multiline
          />
          <Field label="Company types" value={companyTypes} onChange={setCompanyTypes} />
          <Field label="Industries" value={industries} onChange={setIndustries} />
          <Field
            label="Relevant business characteristics"
            value={characteristics}
            onChange={setCharacteristics}
            multiline
          />
          <Field
            label="Positive signals"
            value={positiveSignals}
            onChange={setPositiveSignals}
            multiline
          />
          <Field
            label="Required criteria"
            value={requiredCriteria}
            onChange={setRequiredCriteria}
            multiline
          />
          <Field label="Exclude" value={exclusions} onChange={setExclusions} multiline />
          <Field label="Likely decision-maker roles" value={roles} onChange={setRoles} />
          {proposal.ambiguity?.requiresClarification && proposal.ambiguity.question ? (
            <div className={shared.stack}>
              <strong>One clarification</strong>
              <p>{proposal.ambiguity.question}</p>
              {proposal.ambiguity.options?.length ? (
                <div className={styles.options}>
                  {proposal.ambiguity.options.map((option) => (
                    <label className={styles.option} key={option.label}>
                      <input
                        type="radio"
                        name="clarificationOption"
                        checked={clarificationAnswer === option.label}
                        onChange={() => setClarificationAnswer(option.label)}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <br />
                        {option.summary}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              <Field
                label="Your answer"
                value={clarificationAnswer}
                onChange={setClarificationAnswer}
                multiline
              />
            </div>
          ) : null}
          {targetClientIssue ? <p className={styles.error}>{targetClientIssue}</p> : null}
          <Navigation
            back={() => setStep(2)}
            next={() => setStep(4)}
            disabled={Boolean(targetClientIssue)}
          />
        </section>
      ) : null}

      {step === 4 && proposal && confirmedBrief ? (
        <section className={shared.stack}>
          <div>
            <h2>Start campaign</h2>
            <p>One click starts market analysis and the staged discovery workflow.</p>
          </div>
          <label className={form.field}>
            <span>Campaign name</span>
            <input
              className={form.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className={form.field}>
            <span>Qualified companies wanted</span>
            <input
              className={form.input}
              type="number"
              min={1}
              max={500}
              value={desiredQualifiedCompanies}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDesiredQualifiedCompanies(
                  Number.isFinite(value) ? Math.min(500, Math.max(1, value)) : 1,
                );
              }}
            />
          </label>
          <div className={styles.proposal}>
            <p>
              <span>Target market</span>
              <strong>{geographyLabel}</strong>
            </p>
            <p>
              <span>Recommended offering</span>
              <strong>{offeringTitle}</strong>
            </p>
            <p>
              <span>Recommended target client</span>
              <strong>{targetSummary}</strong>
            </p>
            <p>
              <span>Exclude</span>
              <strong>{split(exclusions).join(", ") || "None"}</strong>
            </p>
            <p>
              <span>Qualified companies wanted</span>
              <strong>{desiredQualifiedCompanies}</strong>
            </p>
          </div>
          <form action={createCampaignAction}>
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="geography" value={geographyLabel} />
            <input
              type="hidden"
              name="selectedOfferingId"
              value={selectedOfferingIds[0]}
            />
            <input type="hidden" name="targetSegments" value={companyTypes} />
            <input type="hidden" name="industryTerms" value={industries} />
            <input type="hidden" name="qualificationCriteria" value={requiredCriteria} />
            <input type="hidden" name="exclusions" value={exclusions} />
            <input
              type="hidden"
              name="language"
              value={proposal.geography.primaryLanguage ?? "English"}
            />
            <input
              type="hidden"
              name="desiredLeadCount"
              value={desiredQualifiedCompanies}
            />
            <input type="hidden" name="objective" value={targetSummary} />
            <input
              type="hidden"
              name="terms"
              value={[offeringTitle, ...split(industries), ...split(companyTypes)].join(
                ", ",
              )}
            />
            <input type="hidden" name="localizedTerms" value="" />
            <input
              type="hidden"
              name="sourceCategories"
              value="Company websites, public business directories, trade associations, event exhibitors, partner directories"
            />
            <input
              type="hidden"
              name="offeringOverrides"
              value={JSON.stringify(confirmedBrief.offering)}
            />
            <input type="hidden" name="briefProposal" value={JSON.stringify(proposal)} />
            <input
              type="hidden"
              name="confirmedBrief"
              value={JSON.stringify(confirmedBrief)}
            />
            <input
              type="hidden"
              name="clarificationAnswer"
              value={JSON.stringify(
                clarificationAnswer.trim()
                  ? { answer: clarificationAnswer.trim() }
                  : null,
              )}
            />
            <input
              type="hidden"
              name="proposalPromptVersion"
              value={result?.promptVersion ?? "company-profile-defaults-v1"}
            />
            <input
              type="hidden"
              name="proposalRequestedModel"
              value={result?.requestedModel ?? ""}
            />
            <input
              type="hidden"
              name="proposalActualModel"
              value={result?.actualModel ?? ""}
            />
            <input
              type="hidden"
              name="proposalFallbackUsed"
              value={String(result?.fallbackUsed ?? false)}
            />
            <div className={styles.navigation}>
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button type="submit" variant="primary" disabled={!name.trim()}>
                Start campaign
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </AiGuidedWorkspace>
  );
}

function buildProfileDefaultProposal(
  profile: CompanyProfile,
  geography: { countryCodes: string[]; regionLabel: string },
  offeringIds: string[],
): CampaignBriefProposal {
  const structured = profile.structuredProfile;
  if (!structured) throw new Error("The Company Profile is not available.");
  const offerings = structured.offerings.filter((offering) =>
    offeringIds.includes(offering.id),
  );
  if (!offerings.length) throw new Error("Select at least one Company Profile offering.");
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  const companyTypes = unique(
    offerings.flatMap((offering) => offering.targetCustomerTypes),
  );
  const industries = unique(offerings.flatMap((offering) => offering.targetIndustries));
  const roles = unique(
    offerings.flatMap((offering) =>
      offering.buyerPersonas.flatMap((persona) => [
        persona.titleGroup,
        ...persona.exampleTitles,
      ]),
    ),
  );
  const title = offerings.map((offering) => offering.name).join(" + ");
  const market =
    geography.regionLabel || geography.countryCodes.join(", ") || "the selected market";
  const targetLabel =
    companyTypes.join(", ") || structured.customerLandscape?.customerTypes.join(", ");
  return {
    geography: {
      countryCodes: geography.countryCodes,
      ...(geography.regionLabel ? { regionLabel: geography.regionLabel } : {}),
      ...(structured.outreachLanguages[0] || structured.supportedLanguages[0]
        ? {
            primaryLanguage:
              structured.outreachLanguages[0] ?? structured.supportedLanguages[0],
          }
        : {}),
    },
    offering: {
      profileOfferingIds: offerings.map((offering) => offering.id),
      title,
      summary: offerings
        .map((offering) => offering.shortDescription)
        .filter(Boolean)
        .join(" "),
      valueProposition: offerings
        .map(
          (offering) =>
            offering.valueProposition ||
            offering.expectedOutcomes.join(", ") ||
            offering.shortDescription,
        )
        .join(" "),
      rationale:
        "Loaded from the selected Company Profile offering defaults. Adjustments remain campaign-specific.",
    },
    targetClient: {
      companyTypes: companyTypes.length
        ? companyTypes
        : (structured.customerLandscape?.customerTypes ?? []),
      industries: industries.length
        ? industries
        : (structured.customerLandscape?.buyerIndustries ?? []),
      characteristics: unique(
        offerings.flatMap((offering) => [
          ...offering.customerProblems,
          ...offering.useCases,
          ...offering.targetCompanySizes,
        ]),
      ),
      positiveSignals: unique(offerings.flatMap((offering) => offering.expectedOutcomes)),
      requiredCriteria: unique(
        offerings.flatMap((offering) => offering.qualificationRequirements),
      ),
      exclusions: unique(
        offerings.flatMap((offering) => offering.disqualifyingConditions),
      ),
      recommendedDecisionMakerRoles: roles,
      summary: `${targetLabel || "Relevant B2B companies"} in ${market} for ${title}.`,
    },
    ambiguity: { requiresClarification: false },
    confidence: 0.75,
  };
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className={form.field}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          className={form.textarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={form.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function Navigation({
  back,
  next,
  disabled = false,
}: {
  back: () => void;
  next: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.navigation}>
      <Button type="button" variant="ghost" onClick={back}>
        Back
      </Button>
      <Button type="button" variant="primary" onClick={next} disabled={disabled}>
        Continue
      </Button>
    </div>
  );
}

function split(value: string) {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

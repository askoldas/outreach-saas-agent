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
import { isConsumerOnlyLabel } from "@/lib/campaign-workflow/target-segments";
import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import shared from "@/features/shared/Feature.module.css";
import {
  AiGuidedWorkspace,
  GuidedOptionCard,
  GuidedStatus,
} from "@/features/guided/AiGuidedWorkspace";
import {
  OfferingSuggestionCard,
  TargetSuggestionCard,
} from "@/features/guided/SuggestionCards";
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
  strategyV2 = false,
}: {
  error?: string;
  profile: CompanyProfile;
  initialDraft: GuidedDraft | null;
  strategyV2?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [countryInput, setCountryInput] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [proposal, setProposal] = useState<CampaignBriefProposal | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("direct_buyer");
  const [selectedTargetSegmentIds, setSelectedTargetSegmentIds] = useState<string[]>([]);
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
      : !selectedTargetSegmentIds.length
        ? "Include at least one organization target to continue."
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
        profileOfferingIds: [selectedOfferingId],
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
      targetSegments: proposal.targetSegments.map((segment, index) => ({
        ...segment,
        ...(index === 0
          ? {
              organizationTypes: split(companyTypes),
              industries: split(industries),
              characteristics: split(characteristics),
              buyingSignals: split(positiveSignals),
              likelyBuyerRoles: split(roles),
              exclusions: split(exclusions),
              summary: targetSummary,
            }
          : {}),
        geographies: countryCodes,
        status: selectedTargetSegmentIds.includes(segment.id) ? "confirmed" : "rejected",
      })),
      desiredQualifiedCompanies,
    };
  }, [
    proposal,
    selectedTargetSegmentIds,
    selectedOfferingId,
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
        (offering) => offering.status !== "excluded" && offering.status !== "rejected",
      ) ?? [];
    const preferred =
      offerings.find((offering) => offering.priority === "primary") ?? offerings[0];
    if (!preferred) {
      setProposalError("The Company Profile has no campaign-ready offering.");
      return;
    }
    const next = buildProfileDefaultProposal(
      profile,
      { countryCodes, regionLabel },
      preferred.id,
    );
    setResult(null);
    applyProposal(next);
    setName(`${next.offering.title} — ${geographyLabel}`);
    setStep(2);
  }

  function applyProposal(next: CampaignBriefProposal) {
    setProposal(next);
    setSelectedOfferingId(next.offering.profileOfferingIds[0] ?? "");
    setSelectedTargetSegmentIds(
      next.targetSegments
        .filter((segment) => segment.status !== "rejected")
        .map((segment) => segment.id),
    );
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

  function selectOffering(offeringId: string) {
    setSelectedOfferingId(offeringId);
    setResult(null);
    applyProposal(
      buildProfileDefaultProposal(profile, { countryCodes, regionLabel }, offeringId),
    );
  }

  function toggleTargetSegment(segmentId: string) {
    setSelectedTargetSegmentIds((current) =>
      current.includes(segmentId)
        ? current.filter((id) => id !== segmentId)
        : [...current, segmentId],
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
          <label className={form.field}>
            <span>Campaign objective</span>
            <select
              className={form.select}
              value={campaignObjective}
              onChange={(event) => setCampaignObjective(event.target.value)}
            >
              <option value="direct_buyer">Find direct buyers</option>
              <option value="distributor">Find distributors</option>
              <option value="reseller">Find resellers</option>
              <option value="channel_partner">Find channel partners</option>
              <option value="implementation_partner">Find implementation partners</option>
              <option value="referral_partner">Find referral partners</option>
              <option value="supplier">Find suppliers</option>
              <option value="strategic_partner">Find strategic partners</option>
            </select>
          </label>
          <div className={shared.stack}>
            <strong>Select one primary offering</strong>
            <p>
              Supporting capabilities can be reflected in the campaign copy, but the
              selected primary offering is the single Company Profile offering stored for
              this campaign. This does not change the Company Profile.
            </p>
            <input
              type="radio"
              name="primaryOffering"
              value={selectedOfferingId}
              checked
              readOnly
              hidden
            />
            <div className={styles.options}>
              {profile.structuredProfile?.offerings
                .filter(
                  (offering) =>
                    offering.status !== "excluded" && offering.status !== "rejected",
                )
                .map((offering) => (
                  <OfferingSuggestionCard
                    key={offering.id}
                    offering={offering}
                    primary={selectedOfferingId === offering.id}
                    onSelect={() => selectOffering(offering.id)}
                  />
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
              !selectedOfferingId ||
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
            <h2>Review the recommended target client organizations</h2>
            <p>
              Adjustments apply only to this campaign and never change the Company
              Profile.
            </p>
          </div>
          <div className={styles.options}>
            {proposal.targetSegments.map((segment) => (
              <TargetSuggestionCard
                key={segment.id}
                segment={segment}
                selected={selectedTargetSegmentIds.includes(segment.id)}
                onToggle={() => toggleTargetSegment(segment.id)}
              />
            ))}
          </div>
          <details className={styles.proposal}>
            <summary>Advanced targeting</summary>
            <div className={shared.stack}>
              <p>
                Refine discovery signals and exclusions only when the recommended target
                needs additional constraints.
              </p>
              <Field
                label="Summary"
                value={targetSummary}
                onChange={setTargetSummary}
                multiline
              />
              <Field
                label="Company types"
                value={companyTypes}
                onChange={setCompanyTypes}
              />
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
              <Field
                label="Exclude"
                value={exclusions}
                onChange={setExclusions}
                multiline
              />
              <Field
                label="Likely decision-maker roles"
                value={roles}
                onChange={setRoles}
              />
            </div>
          </details>
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
              <span>Target organizations and relationships</span>
              <strong>
                {confirmedBrief.targetSegments
                  .filter((segment) => segment.status === "confirmed")
                  .map(
                    (segment) =>
                      `${segment.name} (${segment.relationshipType.replaceAll("_", " ")})`,
                  )
                  .join(", ")}
              </strong>
            </p>
            <p>
              <span>Likely decision makers</span>
              <strong>
                {Array.from(
                  new Set(
                    confirmedBrief.targetSegments.flatMap(
                      (segment) => segment.likelyBuyerRoles,
                    ),
                  ),
                ).join(", ") || "To be researched"}
              </strong>
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
            <input type="hidden" name="selectedOfferingId" value={selectedOfferingId} />
            <input type="hidden" name="campaignObjective" value={campaignObjective} />
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
                {strategyV2 ? "Build campaign strategy" : "Start campaign"}
              </Button>
            </div>
            {strategyV2 ? (
              <p className={styles.secondaryText}>
                This creates a reviewable Campaign Strategy V2 draft. Discovery starts
                only after explicit strategy confirmation and V2 provider enablement.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </AiGuidedWorkspace>
  );
}

function buildProfileDefaultProposal(
  profile: CompanyProfile,
  geography: { countryCodes: string[]; regionLabel: string },
  offeringId: string,
): CampaignBriefProposal {
  const structured = profile.structuredProfile;
  if (!structured) throw new Error("The Company Profile is not available.");
  const offering = structured.offerings.find((item) => item.id === offeringId);
  if (!offering) throw new Error("Select one Company Profile offering.");
  const offerings = [offering];
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  const companyTypes = unique(
    offerings
      .flatMap((offering) => offering.targetCustomerTypes)
      .filter((value) => !isConsumerOnlyLabel(value)),
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
  const organizationTypes = companyTypes.length
    ? companyTypes
    : [`Organizations purchasing ${offering.name}`];
  const targetLabel = organizationTypes.join(", ");
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
      companyTypes: organizationTypes,
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
    targetSegments: [
      {
        id: "primary_organization_segment",
        name: organizationTypes[0] ?? "Target organizations",
        summary: `${targetLabel} in ${market} for ${title}.`,
        relationshipType: "customer",
        organizationTypes,
        industries,
        geographies: geography.countryCodes,
        characteristics: unique(
          offerings.flatMap((item) => [
            ...item.customerProblems,
            ...item.useCases,
            ...item.targetCompanySizes,
          ]),
        ),
        buyingSignals: unique(offerings.flatMap((item) => item.expectedOutcomes)),
        likelyBuyerRoles: roles,
        exclusions: unique(offerings.flatMap((item) => item.disqualifyingConditions)),
        rationale:
          "Derived from the selected Company Profile offering and Campaign market.",
        supportingEvidence: offerings.flatMap((item) =>
          item.sourceReferences
            .map((source) => source.extractedText)
            .filter((value): value is string => Boolean(value)),
        ),
        discoverability: "medium",
        source: "ai_suggested",
        confidence: "medium",
        status: "suggested",
      },
    ],
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

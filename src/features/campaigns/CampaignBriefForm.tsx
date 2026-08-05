"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createCampaignAction,
  proposeCampaignBriefAction,
} from "@/server/campaigns/actions";
import type {
  CampaignBriefProposal,
  ConfirmedCampaignBrief,
} from "@/lib/campaign-workflow/contracts";
import {
  assessCampaignTargetDiscoverability,
  type B2BRelationshipType,
  type TargetSegment,
} from "@/lib/campaign-workflow/target-segments";
import type {
  CampaignPlanningOffering,
  CampaignPlanningProfile,
} from "@/lib/intelligence/campaign-strategy-v2";
import {
  defaultRelationshipForObjective,
  isObjectiveRelationshipCompatible,
  parseCampaignObjective,
} from "@/lib/campaign-workflow/objective-compatibility";
import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import shared from "@/features/shared/Feature.module.css";
import {
  AiGuidedWorkspace,
  GuidedOptionCard,
  GuidedStatus,
} from "@/features/guided/AiGuidedWorkspace";
import {
  NativeOfferingSuggestionCard,
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
}: {
  error?: string;
  profile: CampaignPlanningProfile;
  initialDraft: GuidedDraft | null;
}) {
  const [step, setStep] = useState(1);
  const [countryInput, setCountryInput] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [result, setResult] = useState<ProposalResult | null>(null);
  const [proposal, setProposal] = useState<CampaignBriefProposal | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState(
    profile.offerings[0]?.stableKey ?? "",
  );
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
  const editableTargetSegments = useMemo(() => {
    if (!proposal) return [];
    return proposal.targetSegments.map((segment, index) => {
      const editedSegment: TargetSegment = {
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
      };
      return {
        ...editedSegment,
        discoverability: assessCampaignTargetDiscoverability(editedSegment),
      };
    });
  }, [
    proposal,
    companyTypes,
    industries,
    characteristics,
    positiveSignals,
    roles,
    exclusions,
    targetSummary,
    countryCodes,
  ]);
  const incompatibleSelectedRelationship = editableTargetSegments.find(
    (segment) =>
      selectedTargetSegmentIds.includes(segment.id) &&
      !isObjectiveRelationshipCompatible(
        parseCampaignObjective(campaignObjective),
        segment.relationshipType,
      ),
  )?.relationshipType;
  const selectedLowDiscoverabilityTarget = editableTargetSegments.find(
    (segment) =>
      selectedTargetSegmentIds.includes(segment.id) && segment.discoverability === "low",
  );
  const lowDiscoverabilityTargets = editableTargetSegments.filter(
    (segment) => segment.discoverability === "low",
  );
  const targetClientIssue = !targetSummary.trim()
    ? "Add a target-client summary to continue."
    : !split(companyTypes).length
      ? "Add at least one company type to continue."
      : !selectedTargetSegmentIds.length
        ? "Include at least one organization target to continue."
        : selectedLowDiscoverabilityTarget
          ? `“${selectedLowDiscoverabilityTarget.name}” is too broad or lacks enough searchable signals. Refine the target before continuing.`
          : incompatibleSelectedRelationship
            ? `The selected ${incompatibleSelectedRelationship.replaceAll("_", " ")} target is incompatible with the ${campaignObjective.replaceAll("_", " ")} objective. Generate target organizations again.`
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
      targetSegments: editableTargetSegments.map((segment) => ({
        ...segment,
        status: selectedTargetSegmentIds.includes(segment.id) ? "confirmed" : "rejected",
      })),
      desiredQualifiedCompanies,
    };
  }, [
    proposal,
    editableTargetSegments,
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
        const next = await proposeCampaignBriefAction({
          countryCodes,
          regionLabel,
          objective: campaignObjective,
          selectedOfferingKey: selectedOfferingId,
        });
        setResult(next);
        applyProposal(next.proposal);
        setName(
          `${next.proposal.offering.title} — ${regionLabel || countryCodes.join(", ")}`,
        );
        setStep(3);
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
    const offerings = profile.offerings;
    const selected = offerings.find(
      (offering) => offering.stableKey === selectedOfferingId,
    );
    if (!selected) {
      setProposalError("The Company Profile has no campaign-ready offering.");
      return;
    }
    const next = buildProfileDefaultProposal(
      profile,
      { countryCodes, regionLabel },
      selected.stableKey,
      campaignObjective,
    );
    next.provenance = {
      objective: parseCampaignObjective(campaignObjective),
      selectedOfferingKey: selected.stableKey,
      selectedOfferingVersionId: selected.offeringVersionId,
      profileVersionId: profile.profileVersionId,
      promptVersion: "campaign-brief-proposal-v4-objective-first",
      inputHash: "server-verified-on-confirmation",
    };
    setResult(null);
    applyProposal(next);
    setName(`${next.offering.title} — ${geographyLabel}`);
    setStep(3);
  }

  function applyProposal(next: CampaignBriefProposal) {
    setProposal(next);
    setSelectedOfferingId(next.offering.profileOfferingIds[0] ?? "");
    setSelectedTargetSegmentIds(
      next.targetSegments
        .filter(
          (segment) =>
            segment.status !== "rejected" && segment.discoverability !== "low",
        )
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
    setProposal(null);
  }

  function toggleTargetSegment(segmentId: string) {
    const segment = editableTargetSegments.find((candidate) => candidate.id === segmentId);
    const selected = selectedTargetSegmentIds.includes(segmentId);
    if (!selected && segment?.discoverability === "low") {
      setProposalError(
        `“${segment.name}” cannot be included yet. Refine its organization type and discovery signals, or generate another suggestion.`,
      );
      return;
    }
    setProposalError("");
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
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className={shared.stack}>
          <div>
            <h2>Choose the commercial objective and primary offering</h2>
            <p>
              These frozen inputs determine which organization relationships may be
              proposed.
            </p>
          </div>
          <label className={form.field}>
            <span>Campaign objective</span>
            <select
              className={form.select}
              value={campaignObjective}
              onChange={(event) => {
                setCampaignObjective(event.target.value);
                setResult(null);
                setProposal(null);
              }}
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
              {profile.offerings.map((offering) => (
                <NativeOfferingSuggestionCard
                  key={offering.stableKey}
                  offering={offering}
                  primary={selectedOfferingId === offering.stableKey}
                  onSelect={() => selectOffering(offering.stableKey)}
                />
              ))}
            </div>
          </div>
          <div className={styles.navigation}>
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending || !selectedOfferingId}
              onClick={startWithProfileDefaults}
            >
              Adapt Company Profile targets
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={pending || !selectedOfferingId}
              onClick={generateProposal}
            >
              Generate target organizations
            </Button>
          </div>
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
          {lowDiscoverabilityTargets.length ? (
            <div className={styles.proposal}>
              <strong>Some targets need refinement</strong>
              <p>
                Low-discoverability targets are not selected automatically. Add a concrete
                organization type and useful discovery signals below, or generate another
                suggestion.
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={generateProposal}
              >
                Generate another suggestion
              </Button>
            </div>
          ) : null}
          <div className={styles.options}>
            {editableTargetSegments.map((segment) => (
              <TargetSuggestionCard
                key={segment.id}
                segment={segment}
                selected={selectedTargetSegmentIds.includes(segment.id)}
                disabled={segment.discoverability === "low"}
                disabledReason={
                  segment.discoverability === "low"
                    ? "This target is too broad or lacks concrete discovery signals. Refine it in Advanced targeting before including it."
                    : undefined
                }
                onToggle={() => toggleTargetSegment(segment.id)}
              />
            ))}
          </div>
          <details
            className={styles.proposal}
            defaultOpen={lowDiscoverabilityTargets.length > 0}
          >
            <summary>
              {lowDiscoverabilityTargets.length
                ? "Improve target discoverability"
                : "Advanced targeting"}
            </summary>
            <div className={shared.stack}>
              <p>
                Refine organization types, industries, business characteristics and buying
                signals when the recommended target needs to become more searchable.
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
          {targetClientIssue ? <p className={styles.error}>{targetClientIssue}</p> : null}
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
              <Button
                type="submit"
                variant="primary"
                disabled={!name.trim() || Boolean(targetClientIssue)}
              >
                Build campaign strategy
              </Button>
            </div>
            <p className={styles.secondaryText}>
              This creates a reviewable native Campaign Strategy V2 draft. Discovery
              starts only after explicit strategy confirmation.
            </p>
          </form>
        </section>
      ) : null}
    </AiGuidedWorkspace>
  );
}

function buildProfileDefaultProposal(
  profile: CampaignPlanningProfile,
  geography: { countryCodes: string[]; regionLabel: string },
  offeringId: string,
  objectiveValue: string,
): CampaignBriefProposal {
  const offering = profile.offerings.find((item) => item.stableKey === offeringId);
  if (!offering) throw new Error("Select one Company Profile offering.");
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  const objective = parseCampaignObjective(objectiveValue);
  const archetypes = offering.archetypes
    .filter(
      (archetype) =>
        archetype.status !== "user_rejected" &&
        archetype.status !== "superseded" &&
        archetype.priority !== "avoid" &&
        isObjectiveRelationshipCompatible(
          objective,
          briefRelationshipType(archetype.relationshipType),
        ),
    )
    .slice(0, 5);
  const roles = unique(archetypes.flatMap((archetype) => archetype.likelyDecisionRoles));
  const title = offering.name;
  const market =
    geography.regionLabel || geography.countryCodes.join(", ") || "the selected market";
  const organizationTypes = archetypes.length
    ? unique(archetypes.map((archetype) => archetype.name))
    : [`Organizations commercially compatible with ${offering.name}`];
  const targetLabel = organizationTypes.join(", ");
  const characteristics = unique([
    ...offering.commercialMechanics.customerProblems,
    ...offering.buyerLogic.requiredConditions,
    ...offering.buyerLogic.preferredConditions,
  ]);
  const positiveSignals = unique([
    ...offering.commercialMechanics.expectedOutcomes,
    ...offering.buyerLogic.likelyTriggers,
    ...archetypes.flatMap((archetype) => archetype.positiveSignals),
  ]);
  const requiredCriteria = unique([
    ...offering.buyerLogic.requiredConditions,
    ...archetypes.flatMap((archetype) => archetype.requiredEvidence),
  ]);
  const exclusions = unique([
    ...offering.buyerLogic.incompatibleConditions,
    ...archetypes.flatMap((archetype) => archetype.negativeSignals),
  ]);
  const targetSegments = archetypes.length
    ? archetypes.map((archetype, index) =>
        profileArchetypeSegment({
          archetype,
          geography,
          offering,
          index,
          objective,
        }),
      )
    : [
        fallbackOfferingSegment({
          geography,
          offering,
          organizationTypes,
          roles,
          objective,
        }),
      ];
  return {
    geography: {
      countryCodes: geography.countryCodes,
      ...(geography.regionLabel ? { regionLabel: geography.regionLabel } : {}),
      primaryLanguage: profile.primaryLanguage,
    },
    offering: {
      profileOfferingIds: [offering.stableKey],
      title,
      summary: offering.shortDescription,
      valueProposition:
        offering.commercialMechanics.valueProposition.join(" ") ||
        offering.commercialMechanics.expectedOutcomes.join(", ") ||
        offering.shortDescription,
      rationale:
        "Loaded from the selected published Company Intelligence V3 offering. Campaign adjustments do not mutate the profile.",
    },
    targetClient: {
      companyTypes: organizationTypes,
      industries: [],
      characteristics,
      positiveSignals,
      requiredCriteria,
      exclusions,
      recommendedDecisionMakerRoles: roles,
      summary: `${targetLabel || "Relevant B2B companies"} in ${market} for ${title}.`,
    },
    targetSegments,
    ambiguity: { requiresClarification: false },
    confidence: offering.confidence,
  };
}

function profileArchetypeSegment(input: {
  archetype: CampaignPlanningOffering["archetypes"][number];
  geography: { countryCodes: string[]; regionLabel: string };
  offering: CampaignPlanningOffering;
  index: number;
  objective: ReturnType<typeof parseCampaignObjective>;
}): TargetSegment {
  const market =
    input.geography.regionLabel ||
    input.geography.countryCodes.join(", ") ||
    "the selected market";
  return {
    id: campaignKey(input.archetype.key || `profile-archetype-${input.index + 1}`),
    name: input.archetype.name,
    summary: `${input.archetype.description} Target market: ${market}.`,
    relationshipType: defaultRelationshipForObjective(input.objective),
    organizationTypes: [input.archetype.name],
    industries: [],
    geographies: input.geography.countryCodes,
    characteristics: uniqueStrings([
      ...input.offering.buyerLogic.requiredConditions,
      ...input.offering.buyerLogic.preferredConditions,
    ]),
    buyingSignals: uniqueStrings([
      ...input.archetype.positiveSignals,
      ...input.offering.buyerLogic.likelyTriggers,
    ]),
    likelyBuyerRoles: input.archetype.likelyDecisionRoles,
    exclusions: uniqueStrings([
      ...input.archetype.negativeSignals,
      ...input.offering.buyerLogic.incompatibleConditions,
    ]),
    rationale: input.archetype.whyCompatible.join(" ") || input.archetype.description,
    supportingEvidence: input.archetype.whyCompatible,
    discoverability: "medium",
    source: "saved_template",
    confidence:
      input.archetype.confidence >= 0.75
        ? "high"
        : input.archetype.confidence >= 0.45
          ? "medium"
          : "low",
    status: "suggested",
  };
}

function fallbackOfferingSegment(input: {
  geography: { countryCodes: string[]; regionLabel: string };
  offering: CampaignPlanningOffering;
  organizationTypes: string[];
  roles: string[];
  objective: ReturnType<typeof parseCampaignObjective>;
}): TargetSegment {
  const relationship =
    input.offering.relationshipOptions.find((option) => option.relevance === "primary") ??
    input.offering.relationshipOptions[0];
  return {
    id: "primary-organization-segment",
    name: input.organizationTypes[0] ?? "Target organizations",
    summary: `Organizations in ${
      input.geography.regionLabel || input.geography.countryCodes.join(", ")
    } with a plausible commercial fit for ${input.offering.name}.`,
    relationshipType: defaultRelationshipForObjective(input.objective),
    organizationTypes: input.organizationTypes,
    industries: [],
    geographies: input.geography.countryCodes,
    characteristics: uniqueStrings([
      ...input.offering.commercialMechanics.customerProblems,
      ...input.offering.buyerLogic.requiredConditions,
    ]),
    buyingSignals: uniqueStrings([
      ...input.offering.commercialMechanics.expectedOutcomes,
      ...input.offering.buyerLogic.likelyTriggers,
    ]),
    likelyBuyerRoles: input.roles,
    exclusions: input.offering.buyerLogic.incompatibleConditions,
    rationale:
      relationship?.rationale ?? "Derived directly from the selected published offering.",
    supportingEvidence: [],
    discoverability: "medium",
    source: "saved_template",
    confidence: input.offering.confidence >= 0.7 ? "high" : "medium",
    status: "suggested",
  };
}

function briefRelationshipType(value: string): B2BRelationshipType {
  if (value === "direct_buyer" || value === "end_user") return "customer";
  if (value === "distributor" || value === "reseller" || value === "supplier") {
    return value;
  }
  if (value === "implementation_partner") return "contractor";
  return "partner";
}

function campaignKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "target-segment"
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
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

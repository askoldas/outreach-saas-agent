"use server";

import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { guidedScopes, type GuidedScope } from "@/lib/guided/contracts";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { recordGuidedExchange, saveGuidedDraft } from "./repository";
import { interpretGuidedChange } from "@/lib/ai/guided-interpretation";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { getCampaign } from "@/server/campaigns/repository";
import { parseProposedChange, type ProposedChange } from "@/lib/guided/contracts";
import {
  parseStructuredCompanyProfile,
  calculateReadiness,
} from "@/lib/company-profile/structured-profile";
import { saveCompanyProfileVersion } from "@/server/company-profile/repository";
import {
  getCurrentCampaignStrategy,
  saveCampaignStrategyVersion,
} from "@/server/campaign-strategy/repository";
import { recordAppliedChanges } from "./repository";
import { revalidatePath } from "next/cache";

export async function saveGuidedDraftAction(input: {
  scope: GuidedScope;
  entityId: string;
  baseVersion: number;
  currentStep: string;
  completedSteps: string[];
  draftData: Record<string, unknown>;
  status?: "draft" | "ready";
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  if (!guidedScopes.includes(input.scope) || !input.entityId.trim())
    throw new Error("Invalid guided draft context.");
  const { user } = await createAuthenticatedDatabaseClient();
  const draft = await saveGuidedDraft(currentWorkspace.id, user.id, {
    scope: input.scope,
    entityId: input.entityId,
    baseVersion: input.baseVersion,
    currentStep: input.currentStep.slice(0, 100),
    completedSteps: input.completedSteps.slice(0, 20),
    draftData: input.draftData,
    status: input.status ?? "draft",
  });
  return { draft, message: "Guided draft saved." };
}

export async function interpretGuidedRequestAction(input: {
  scope: "company" | "campaign";
  entityId: string;
  request: string;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  if (input.request.trim().length < 3) throw new Error("Describe the requested change.");
  const context =
    input.scope === "company"
      ? await getCurrentCompanyProfile(currentWorkspace.id)
      : await getCampaign(currentWorkspace.id, input.entityId);
  if (!context) throw new Error("The active guided context no longer exists.");
  const interpreted = await interpretGuidedChange({
    scope: input.scope,
    entityId: input.entityId,
    request: input.request.trim(),
    context: context as unknown as Record<string, unknown>,
  });
  const { user } = await createAuthenticatedDatabaseClient();
  await recordGuidedExchange(currentWorkspace.id, user.id, {
    scope: input.scope,
    entityId: input.entityId,
    request: input.request.trim(),
    response: interpreted.response,
  });
  return interpreted.response;
}

export async function interpretCampaignDraftRequestAction(input: {
  request: string;
  draftData: Record<string, unknown>;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  if (input.request.trim().length < 3) throw new Error("Describe the requested change.");
  const interpreted = await interpretGuidedChange({
    scope: "campaign",
    entityId: "new",
    request: input.request.trim(),
    context: input.draftData,
  });
  const { user } = await createAuthenticatedDatabaseClient();
  await recordGuidedExchange(currentWorkspace.id, user.id, {
    scope: "campaign",
    entityId: "new",
    request: input.request.trim(),
    response: interpreted.response,
  });
  return interpreted.response;
}

export async function applyGuidedProposalAction(input: {
  scope: "company" | "campaign";
  entityId: string;
  baseVersion: number;
  changes: ProposedChange[];
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  const changes = input.changes.map(parseProposedChange);
  if (!changes.length || changes.some((change) => !change.requiresConfirmation))
    throw new Error("No confirmable proposed changes were supplied.");
  const { user } = await createAuthenticatedDatabaseClient();

  if (input.scope === "company") {
    const current = await getCurrentCompanyProfile(currentWorkspace.id);
    if (!current?.structuredProfile) throw new Error("Company Profile is unavailable.");
    if (current.version !== input.baseVersion)
      throw new Error(
        "The Company Profile changed while this proposal was open. Interpret it again.",
      );
    const draft = structuredClone(current.structuredProfile);
    for (const change of changes) applyCompanyChange(draft, change);
    draft.readiness = calculateReadiness(draft);
    await saveCompanyProfileVersion(currentWorkspace.id, {
      ...current,
      structuredProfile: parseStructuredCompanyProfile(draft),
      provenance: "manual",
    });
    await recordAppliedChanges(currentWorkspace.id, user.id, {
      entityId: input.entityId,
      baseVersion: input.baseVersion,
      source: "natural_language",
      changes,
    });
    revalidatePath("/company-profile");
    return { message: "Applied changes to a new Company Profile version." };
  }

  const strategy = await getCurrentCampaignStrategy(currentWorkspace.id, input.entityId);
  if (!strategy) throw new Error("Campaign Strategy is unavailable.");
  if (strategy.version !== input.baseVersion)
    throw new Error(
      "The Campaign Strategy changed while this proposal was open. Interpret it again.",
    );
  const next = structuredClone(strategy);
  for (const change of changes) applyCampaignChange(next, change);
  const saved = await saveCampaignStrategyVersion(
    currentWorkspace.id,
    input.entityId,
    next,
  );
  await recordAppliedChanges(currentWorkspace.id, user.id, {
    entityId: input.entityId,
    baseVersion: input.baseVersion,
    source: "natural_language",
    changes,
  });
  revalidatePath(`/campaigns/${input.entityId}/strategy`);
  return { message: `Applied changes as Campaign Strategy version ${saved.version}.` };
}

function applyCompanyChange(
  profile: NonNullable<
    Awaited<ReturnType<typeof getCurrentCompanyProfile>>
  >["structuredProfile"] & {},
  change: ProposedChange,
) {
  const path = change.fieldPath ?? "";
  if (
    [
      "shortOverview",
      "prospectingMarkets",
      "excludedMarkets",
      "outreachLanguages",
    ].includes(path)
  ) {
    if (path === "shortOverview") profile.shortOverview = scalar(change.proposedValue);
    else if (path === "prospectingMarkets")
      profile.prospectingMarkets = strings(change.proposedValue);
    else if (path === "excludedMarkets")
      profile.excludedMarkets = strings(change.proposedValue);
    else profile.outreachLanguages = strings(change.proposedValue);
    return;
  }
  const match = /^offerings\.([^.]+)\.([^.]+)$/.exec(path);
  if (!match) throw new Error(`Unsupported Company Profile field path: ${path}.`);
  const offering = profile.offerings.find((item) => item.id === match[1]);
  if (!offering) throw new Error("The proposed offering no longer exists.");
  const field = match[2];
  if (field === "valueProposition")
    offering.valueProposition = scalar(change.proposedValue);
  else if (field === "buyerPersonas")
    offering.buyerPersonas = strings(change.proposedValue).map((title) => ({
      titleGroup: title,
      exampleTitles: [title],
    }));
  else if (field === "targetCustomerTypes")
    offering.targetCustomerTypes = strings(change.proposedValue);
  else if (field === "targetIndustries")
    offering.targetIndustries = strings(change.proposedValue);
  else if (field === "targetCompanySizes")
    offering.targetCompanySizes = strings(change.proposedValue);
  else if (field === "qualificationRequirements")
    offering.qualificationRequirements = strings(change.proposedValue);
  else if (field === "disqualifyingConditions")
    offering.disqualifyingConditions = strings(change.proposedValue);
  else throw new Error(`Unsupported offering field: ${field}.`);
}

function applyCampaignChange(
  strategy: NonNullable<Awaited<ReturnType<typeof getCurrentCampaignStrategy>>>,
  change: ProposedChange,
) {
  const path = change.fieldPath ?? "";
  if (path === "targetGeography") strategy.targetGeography = scalar(change.proposedValue);
  else if (path === "companyTypes") strategy.companyTypes = strings(change.proposedValue);
  else if (path === "industries") strategy.industries = strings(change.proposedValue);
  else if (path === "qualificationCriteria")
    strategy.qualificationCriteria = strings(change.proposedValue);
  else if (path === "exclusions") strategy.exclusions = strings(change.proposedValue);
  else if (path === "contactRoles") strategy.contactRoles = strings(change.proposedValue);
  else if (path === "relevanceReasons")
    strategy.relevanceReasons = strings(change.proposedValue);
  else throw new Error(`Unsupported Campaign Strategy field path: ${path}.`);
}
function strings(value: unknown) {
  if (typeof value === "string")
    return value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  if (Array.isArray(value) && value.every((item) => typeof item === "string"))
    return value.map((item) => item.trim()).filter(Boolean);
  throw new Error("Proposed value must be text or a list of text values.");
}
function scalar(value: unknown) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Proposed value must be text.");
  return value.trim();
}

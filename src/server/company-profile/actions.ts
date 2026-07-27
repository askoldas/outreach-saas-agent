"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { saveCompanyProfileVersion } from "./repository";
import { getCurrentCompanyProfile } from "./repository";
import { enqueueCompanyProfileAnalysisRun } from "@/server/research/repository";
import {
  calculateReadiness,
  createEmptyStructuredProfile,
  parseStructuredCompanyProfile,
} from "@/lib/company-profile/structured-profile";

export async function saveCompanyProfileAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const current = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!current?.structuredProfile)
    redirect("/company-profile?error=structured-profile-required");
  const section = text(formData, "section");
  const draft = structuredClone(current.structuredProfile);
  if (section === "overview") {
    draft.name = text(formData, "name");
    draft.headquarters = text(formData, "headquarters") || undefined;
    draft.shortOverview = text(formData, "shortOverview");
    draft.extendedOverview = text(formData, "extendedOverview") || undefined;
  } else if (section === "markets") {
    draft.operatingMarkets = list(formData, "operatingMarkets");
    draft.exportMarkets = list(formData, "exportMarkets");
    draft.prospectingMarkets = list(formData, "prospectingMarkets");
    draft.excludedMarkets = list(formData, "excludedMarkets");
    draft.supportedLanguages = list(formData, "supportedLanguages");
    draft.outreachLanguages = list(formData, "outreachLanguages");
  } else if (section === "offering") {
    const offering = draft.offerings.find(
      (item) => item.id === text(formData, "offeringId"),
    );
    if (!offering) redirect("/company-profile?error=offering-not-found");
    offering.name = text(formData, "name");
    offering.shortDescription = text(formData, "shortDescription");
    offering.valueProposition = text(formData, "valueProposition") || undefined;
    offering.targetCustomerTypes = list(formData, "targetCustomerTypes");
    offering.targetIndustries = list(formData, "targetIndustries");
    offering.targetCompanySizes = list(formData, "targetCompanySizes");
    offering.prospectingMarkets = list(formData, "prospectingMarkets");
    offering.qualificationRequirements = list(formData, "qualificationRequirements");
    offering.disqualifyingConditions = list(formData, "disqualifyingConditions");
    offering.commercialConstraints = list(formData, "commercialConstraints");
  } else {
    redirect("/company-profile?error=invalid-profile-section");
  }
  draft.readiness = calculateReadiness(draft);
  draft.status = current.reviewQuestions.some(
    (question) =>
      (question.priority ?? (question.required ? "blocking" : "optional")) ===
        "blocking" && question.status === "unanswered",
  )
    ? "needs_input"
    : "ready";
  await saveCompanyProfileVersion(currentWorkspace.id, {
    ...current,
    structuredProfile: parseStructuredCompanyProfile(draft),
    provenance: "manual",
  });
  revalidatePath("/company-profile");
  revalidatePath("/campaigns/new");
  redirect("/company-profile?message=profile-version-saved");
}

export async function updateOfferingStatusAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const current = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!current?.structuredProfile)
    redirect("/company-profile?error=structured-profile-required");
  const draft = structuredClone(current.structuredProfile);
  const offering = draft.offerings.find(
    (item) => item.id === text(formData, "offeringId"),
  );
  if (!offering) redirect("/company-profile?error=offering-not-found");
  const intent = text(formData, "intent");
  if (intent === "confirm") offering.status = "confirmed";
  else if (intent === "exclude") offering.status = "excluded";
  else if (intent === "capability") {
    draft.capabilities.push({
      id: `cap_${offering.id}`.slice(0, 64),
      name: offering.name,
      description: offering.shortDescription,
      relatedOfferingIds: [],
    });
    offering.status = "excluded";
  } else redirect("/company-profile?error=invalid-offering-action");
  draft.readiness = calculateReadiness(draft);
  await saveCompanyProfileVersion(currentWorkspace.id, {
    ...current,
    structuredProfile: parseStructuredCompanyProfile(draft),
    provenance: "manual",
  });
  revalidatePath("/company-profile");
  redirect("/company-profile?message=offering-updated");
}

export async function answerProfileQuestionAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const current = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!current?.structuredProfile)
    redirect("/company-profile?error=structured-profile-required");
  const questionId = text(formData, "questionId");
  const questions = structuredClone(current.reviewQuestions);
  const question = questions.find((item) => item.id === questionId);
  if (!question) redirect("/company-profile?error=question-not-found");
  const intent = text(formData, "intent");
  if (intent === "dismiss" && !question.required) question.status = "dismissed";
  else if (intent === "skip" && !question.required) question.status = "skipped";
  else {
    const answers = formData
      .getAll("answer")
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!answers.length) redirect("/company-profile?error=question-answer-required");
    question.answer = question.inputType === "multi_select" ? answers : answers[0];
    question.status = "answered";
  }
  const draft = structuredClone(current.structuredProfile);
  if (question.status === "answered") {
    applyQuestionAnswer(
      draft,
      question.category,
      question.relatedOfferingId,
      question.fieldPath,
      question.answer,
    );
  }
  draft.readiness = calculateReadiness(draft);
  draft.status = questions.some(
    (item) =>
      (item.priority ?? (item.required ? "blocking" : "optional")) === "blocking" &&
      item.status === "unanswered",
  )
    ? "needs_input"
    : "ready";
  await saveCompanyProfileVersion(currentWorkspace.id, {
    ...current,
    reviewQuestions: questions,
    structuredProfile: parseStructuredCompanyProfile(draft),
    provenance: "manual",
  });
  revalidatePath("/company-profile");
  redirect("/company-profile?message=question-saved#review-questions");
}

export async function publishCompanyProfileAction() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const current = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!current?.structuredProfile)
    redirect("/company-profile?error=structured-profile-required");
  if (
    current.reviewQuestions.some(
      (item) =>
        (item.priority ?? (item.required ? "blocking" : "optional")) === "blocking" &&
        item.status === "unanswered",
    )
  )
    redirect("/company-profile?error=required-questions-pending#review-questions");
  const draft = {
    ...current.structuredProfile,
    status: "published" as const,
    readiness: calculateReadiness(current.structuredProfile),
  };
  await saveCompanyProfileVersion(currentWorkspace.id, {
    ...current,
    structuredProfile: parseStructuredCompanyProfile(draft),
    provenance: "manual",
  });
  revalidatePath("/company-profile");
  revalidatePath("/campaigns/new");
  redirect("/company-profile?message=profile-published");
}

export async function updateCompanyWebsiteAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const currentProfile = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!currentProfile) redirect("/company-profile?error=company-profile-not-found");
  const website = normalizeWebsite(text(formData, "website"));
  if (!website) redirect("/company-profile?error=invalid-website-url");

  const structuredProfile = currentProfile.structuredProfile
    ? { ...currentProfile.structuredProfile, websiteUrl: website }
    : createEmptyStructuredProfile({
        name: currentProfile.companyName,
        websiteUrl: website,
      });

  await saveCompanyProfileVersion(currentWorkspace.id, {
    ...currentProfile,
    id: null,
    version: 0,
    website,
    lastAnalyzed: null,
    provenance: "manual",
    structuredProfile,
  });
  revalidatePath("/company-profile");
  revalidatePath("/campaigns/new");
  redirect("/company-profile?message=company-website-updated");
}

export async function analyzeCompanyProfileAction() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  let profile = await getCurrentCompanyProfile(currentWorkspace.id);
  const website = profile.website;
  if (!website) redirect("/company-profile?error=website-required");
  if (!profile.id) {
    profile = await saveCompanyProfileVersion(currentWorkspace.id, {
      ...profile,
      provenance: "workspace",
      structuredProfile: createEmptyStructuredProfile({
        name: profile.companyName,
        websiteUrl: website,
      }),
    });
  }
  const profileVersionId = profile.id;
  if (!profileVersionId)
    throw new Error("Could not initialize Company Profile version for analysis.");
  const { runId } = await enqueueCompanyProfileAnalysisRun({
    workspaceId: currentWorkspace.id,
    profileVersionId,
    website,
  });
  revalidatePath("/company-profile");
  revalidatePath("/usage");
  redirect(`/company-profile?message=analysis-queued&run=${runId}`);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function list(formData: FormData, key: string) {
  return text(formData, key)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeWebsite(value: string) {
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname || !["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function applyQuestionAnswer(
  profile: NonNullable<
    Awaited<ReturnType<typeof getCurrentCompanyProfile>>
  >["structuredProfile"] & {},
  category: string,
  offeringId: string | undefined,
  fieldPath: string | undefined,
  answer: string | string[] | undefined,
) {
  if (!answer) return;
  const values = Array.isArray(answer) ? answer : [answer];
  const offering = offeringId
    ? profile.offerings.find((item) => item.id === offeringId)
    : undefined;
  if (fieldPath === "offerings.structure") {
    if (values.join(" ").toLowerCase().includes("confirm"))
      for (const item of profile.offerings)
        if (item.status === "detected") item.status = "confirmed";
  } else if (fieldPath === "offerings.active") {
    const selected = new Set(values);
    for (const item of profile.offerings)
      item.priority = selected.has(item.name) ? "primary" : "inactive";
  } else if (fieldPath === "customerLandscape.relationshipTypes") {
    if (profile.customerLandscape) profile.customerLandscape.relationshipTypes = values;
  } else if (fieldPath === "commercialConstraints") {
    profile.commercialConstraints = values;
  } else if (category === "market") {
    if (offering) offering.prospectingMarkets = values;
    else profile.prospectingMarkets = values;
  } else if (category === "buyer_persona" && offering) {
    offering.buyerPersonas = values.map((title) => ({
      titleGroup: title,
      exampleTitles: [title],
    }));
  } else if (category === "qualification" && offering) {
    offering.qualificationRequirements = values;
  } else if (category === "constraint" && offering) {
    offering.commercialConstraints = values;
  } else if (category === "customer" && offering) {
    offering.targetCustomerTypes = values;
  } else if (category === "claim") {
    profile.communicationRules.approvedClaims = [
      ...new Set([...profile.communicationRules.approvedClaims, ...values]),
    ];
  } else if (category === "offering" && offering) {
    const answerText = values.join(" ").toLowerCase();
    if (answerText.includes("not") || answerText.includes("remove"))
      offering.status = "excluded";
    else offering.status = "confirmed";
  }
}

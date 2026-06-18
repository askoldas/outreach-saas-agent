"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OfferStatus, OfferType } from "@/types/domain";
import { createOffer, importSampleOffers, updateOfferStatus } from "./repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

const offerTypes = new Set<OfferType>([
  "distribution",
  "manufacturing",
  "partnership",
  "product",
  "service",
  "software",
]);

type UpdateOfferStatusInput = {
  offerId: string;
  status: OfferStatus;
};

const offerStatuses = new Set<OfferStatus>(["active", "archived", "draft"]);

export async function updateOfferStatusAction(input: UpdateOfferStatusInput) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  if (!input.offerId || !offerStatuses.has(input.status)) {
    throw new Error("Unsupported offer status.");
  }

  await updateOfferStatus(currentWorkspace.id, input.offerId, input.status);

  revalidatePath("/dashboard");
  revalidatePath("/offers");
  revalidatePath(`/offers/${input.offerId}`);

  return {
    message:
      input.status === "active"
        ? "Offer activated"
        : input.status === "archived"
          ? "Offer archived"
          : "Offer moved to draft",
  };
}

export async function createOfferAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const name = getString(formData, "offer-name");
  const summary = getString(formData, "summary");
  const type = getOfferType(getString(formData, "offerType"));

  if (name.length < 2 || summary.length < 12) {
    redirect(
      `/offers/new?error=${encodeURIComponent(
        "Enter an offer name and a summary with at least 12 characters.",
      )}`,
    );
  }

  const offer = await createOffer(currentWorkspace.id, {
    buyerTypes: getList(formData, "buyers"),
    capabilities: getList(formData, "capabilities"),
    customerValue: getList(formData, "value"),
    differentiators: getList(formData, "differentiators"),
    keywords: getList(formData, "keywords"),
    limitations: getList(formData, "limitations"),
    name,
    problems: getList(formData, "problems"),
    summary,
    type,
  });

  revalidatePath("/dashboard");
  revalidatePath("/offers");
  redirect(`/offers/${offer.id}`);
}

export async function importSampleOffersAction() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  await importSampleOffers(currentWorkspace.id);

  revalidatePath("/dashboard");
  revalidatePath("/offers");
  redirect("/offers?message=sample-offers-imported");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getList(formData: FormData, key: string) {
  return getString(formData, key)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getOfferType(value: string): OfferType {
  return offerTypes.has(value as OfferType) ? (value as OfferType) : "service";
}

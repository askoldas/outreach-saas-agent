"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OfferType } from "@/types/domain";
import { createOffer, importSampleOffers } from "./repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

const offerTypes = new Set<OfferType>([
  "distribution",
  "manufacturing",
  "partnership",
  "product",
  "service",
  "software",
]);

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

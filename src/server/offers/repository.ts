import { offers as sampleOffers } from "@/data/mock/prospecting";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Offer, OfferStatus, OfferType } from "@/types/domain";

type OfferRow = {
  ai_proposals: string[];
  approved_version: string;
  buyer_types: string[];
  campaign_count: number;
  capabilities: string[];
  customer_value: string[];
  differentiators: string[];
  external_id: string;
  keywords: string[];
  last_updated_label: string;
  limitations: string[];
  missing_info: string[];
  name: string;
  problems: string[];
  status: OfferStatus;
  summary: string;
  type: OfferType;
};

type CreateOfferInput = {
  buyerTypes: string[];
  capabilities: string[];
  customerValue: string[];
  differentiators: string[];
  keywords: string[];
  limitations: string[];
  name: string;
  problems: string[];
  summary: string;
  type: OfferType;
};

const offerSelect = `
  external_id,
  name,
  type,
  summary,
  status,
  approved_version,
  last_updated_label,
  campaign_count,
  problems,
  capabilities,
  customer_value,
  buyer_types,
  differentiators,
  limitations,
  keywords,
  ai_proposals,
  missing_info
`;

export async function listOffers(workspaceId: string): Promise<Offer[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("offers")
    .select(offerSelect)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load offers: ${error.message}`);
  }

  return ((data ?? []) as OfferRow[]).map(mapOffer);
}

export async function getOffer(
  workspaceId: string,
  offerId: string,
): Promise<Offer | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("offers")
    .select(offerSelect)
    .eq("workspace_id", workspaceId)
    .eq("external_id", offerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load offer: ${error.message}`);
  }

  return data ? mapOffer(data as OfferRow) : null;
}

export async function createOffer(
  workspaceId: string,
  input: CreateOfferInput,
): Promise<Offer> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const externalId = await createUniqueOfferExternalId(workspaceId, input.name);
  const { data, error } = await supabase
    .from("offers")
    .insert({
      approved_version: "No approved version",
      buyer_types: input.buyerTypes,
      capabilities: input.capabilities,
      customer_value: input.customerValue,
      differentiators: input.differentiators,
      external_id: externalId,
      keywords: input.keywords,
      limitations: input.limitations,
      missing_info: ["Review and approve this offer before campaign launch"],
      name: input.name,
      problems: input.problems,
      status: "draft",
      summary: input.summary,
      type: input.type,
      workspace_id: workspaceId,
    })
    .select(offerSelect)
    .single();

  if (error) {
    throw new Error(`Could not create offer: ${error.message}`);
  }

  return mapOffer(data as OfferRow);
}

export async function importSampleOffers(workspaceId: string): Promise<number> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("offers")
    .upsert(
      sampleOffers.map((offer) => ({
        ai_proposals: offer.aiProposals,
        approved_version: offer.approvedVersion,
        buyer_types: offer.buyerTypes,
        campaign_count: offer.campaignCount,
        capabilities: offer.capabilities,
        customer_value: offer.customerValue,
        differentiators: offer.differentiators,
        external_id: offer.id,
        keywords: offer.keywords,
        last_updated_label: offer.lastUpdated,
        limitations: offer.limitations,
        missing_info: offer.missingInfo,
        name: offer.name,
        problems: offer.problems,
        status: offer.status,
        summary: offer.summary,
        type: offer.type,
        workspace_id: workspaceId,
      })),
      { onConflict: "workspace_id,external_id" },
    )
    .select("id");

  if (error) {
    throw new Error(`Could not import sample offers: ${error.message}`);
  }

  return data?.length ?? 0;
}

function mapOffer(row: OfferRow): Offer {
  return {
    aiProposals: row.ai_proposals,
    approvedVersion: row.approved_version,
    buyerTypes: row.buyer_types,
    campaignCount: row.campaign_count,
    capabilities: row.capabilities,
    customerValue: row.customer_value,
    differentiators: row.differentiators,
    id: row.external_id,
    keywords: row.keywords,
    lastUpdated: row.last_updated_label,
    limitations: row.limitations,
    missingInfo: row.missing_info,
    name: row.name,
    problems: row.problems,
    status: row.status,
    summary: row.summary,
    type: row.type,
  };
}

async function createUniqueOfferExternalId(workspaceId: string, name: string) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const baseSlug = slugify(name) || "offer";
  let candidate = baseSlug;
  let suffix = 0;

  while (true) {
    const { data, error } = await supabase
      .from("offers")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("external_id", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not check offer slug: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import { z } from "zod";
import {
  type RelationshipSuppressionEntry,
  type SuppressionRelationship,
  matchRelationshipSuppression,
} from "@/lib/candidate-intelligence-v2";
import type { IntelligenceRule } from "@/lib/intelligence/contracts/rules";
import { createServiceRoleClient } from "@/lib/supabase/service";

const memoryContextSchema = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: z.string().min(1),
    campaignId: z.string().min(1),
    entries: z.array(
      z
        .object({
          organizationId: z.string().min(1).nullable().optional(),
          canonicalDomains: z.array(z.string().min(1)),
          normalizedNames: z.array(z.string().min(1)),
          relationship: z.enum([
            "existing_customer",
            "former_customer",
            "competitor",
            "reseller",
            "distributor",
            "channel_partner",
            "integration_partner",
            "referral_partner",
            "strategic_partner",
            "partner",
            "excluded",
            "unknown",
          ]),
          status: z.enum(["confirmed", "probable", "ambiguous"]),
          confidence: z.number().min(0).max(1),
          evidenceIds: z.array(z.string().min(1)),
          source: z.enum(["prior_qualification", "company_profile", "seller_site", "user_confirmed", "prior_campaign", "crm", "other"]),
        })
        .strict(),
    ),
  })
  .strict();

export async function loadPreResearchSuppressionContext(input: {
  workspaceId: string;
  campaignId: string;
  rules: IntelligenceRule[];
}) {
  const database = createServiceRoleClient() as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await database.rpc("load_pre_research_suppression_context_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_id: input.campaignId,
  });
  if (error) throw new Error(`Could not load relationship suppression: ${error.message}`);
  const memory = memoryContextSchema.parse(data);
  return [
    ...memory.entries.map(
      (entry): RelationshipSuppressionEntry => ({
        ...(entry.organizationId ? { organizationId: entry.organizationId } : {}),
        canonicalDomains: entry.canonicalDomains,
        normalizedNames: entry.normalizedNames,
        status: entry.status,
        confidence: entry.confidence,
        evidenceIds: entry.evidenceIds,
        source: entry.source === "prior_qualification" ? "prior_qualification" : "relationship_memory",
        relationship: partnerRelationship(entry.relationship),
      }),
    ),
    ...explicitExclusionEntries(input.rules),
  ];
}

export { matchRelationshipSuppression };

function partnerRelationship(
  relationship: z.infer<typeof memoryContextSchema>["entries"][number]["relationship"],
): SuppressionRelationship {
  return [
    "reseller",
    "distributor",
    "channel_partner",
    "integration_partner",
    "referral_partner",
    "strategic_partner",
  ].includes(relationship)
    ? ("partner" as const)
    : relationship === "existing_customer" ||
        relationship === "former_customer" ||
        relationship === "competitor"
      ? relationship
      : relationship === "excluded"
        ? "excluded"
        : "partner";
}

function explicitExclusionEntries(rules: IntelligenceRule[]) {
  return rules.flatMap((rule): RelationshipSuppressionEntry[] => {
    if (
      rule.ruleType !== "hard_exclusion" ||
      rule.status !== "confirmed" ||
      rule.strength !== "hard" ||
      rule.source !== "user"
    ) {
      return [];
    }
    const domains = `${rule.label} ${rule.description}`
      .toLowerCase()
      .match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g);
    if (!domains?.length) return [];
    return [
      {
        canonicalDomains: [...new Set(domains)].sort(),
        normalizedNames: [],
        relationship: "excluded",
        status: "confirmed",
        confidence: 1,
        evidenceIds: [...rule.evidenceIds].sort(),
        source: "user_exclusion",
      },
    ];
  });
}

import { z } from "zod";
import {
  campaignStoppingPolicySchema,
  campaignStrategyV2Schema,
  discoverySegmentRequestV2Schema,
  type CampaignStrategyV2,
} from "../intelligence/campaign-strategy-v2/schemas.ts";
import { hashCanonical } from "../intelligence/campaign-strategy-v2/context-compiler.ts";
import { discoveryProviderCapabilitiesSchema } from "./contracts.ts";

export const segmentProviderRouteSchema = z
  .object({
    segmentId: z.string().min(1),
    providers: z
      .array(
        z
          .object({
            providerId: z.string().min(1),
            role: z.enum(["primary", "supporting", "verification"]),
            priority: z.number().int().positive(),
            reasons: z.array(z.string().min(1)).min(1),
            unsupportedConstraints: z.array(z.string()),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const discoveryPlanV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    campaignId: z.string().min(1),
    campaignStrategyVersionId: z.string().min(1),
    marketResearchPlanVersionId: z.string().min(1).optional(),
    memorySnapshotId: z.string().min(1),
    versionNumber: z.number().int().positive(),
    marketBreadth: z
      .enum(["very_narrow", "narrow", "medium", "broad", "very_broad"])
      .default("medium"),
    estimatedCandidateRange: z
      .object({
        min: z.number().int().nonnegative().optional(),
        max: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    status: z.enum(["draft", "ready", "running", "completed", "superseded"]),
    segments: z.array(discoverySegmentRequestV2Schema).min(1),
    routes: z.array(segmentProviderRouteSchema).min(1),
    providerCapabilities: z
      .array(
        z
          .object({
            providerId: z.string().min(1),
            providerVersion: z.string().min(1),
            capabilities: discoveryProviderCapabilitiesSchema,
            contentHash: z.string().length(64),
          })
          .strict(),
      )
      .min(1),
    coveragePolicy: z
      .object({
        minimumCoverageConfidence: z.number().min(0).max(1),
        minimumSourceDiversity: z.number().int().positive(),
        requireLocalLanguageWhenAvailable: z.boolean(),
      })
      .strict(),
    stoppingPolicy: campaignStoppingPolicySchema,
    budgetPolicy: z
      .object({
        maximumProviderCalls: z.number().int().positive(),
        maximumEstimatedCostMinor: z.number().nonnegative().optional(),
        deadlineAt: z.iso.datetime().optional(),
      })
      .strict(),
    compiledAt: z.iso.datetime(),
    contentHash: z.string().length(64),
  })
  .strict()
  .superRefine((plan, context) => {
    const segmentIds = new Set(plan.segments.map(({ id }) => id));
    const capabilityIds = new Set(
      plan.providerCapabilities.map(({ providerId }) => providerId),
    );
    const routeIds = plan.routes.map(({ segmentId }) => segmentId);
    if (
      routeIds.length !== segmentIds.size ||
      routeIds.some((segmentId) => !segmentIds.has(segmentId)) ||
      new Set(routeIds).size !== routeIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["routes"],
        message: "Every semantic segment requires exactly one provider route.",
      });
    }
    if (
      plan.routes.some((route) =>
        route.providers.some(({ providerId }) => !capabilityIds.has(providerId)),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["providerCapabilities"],
        message: "Every routed provider requires a frozen capability snapshot.",
      });
    }
  });

export type DiscoveryPlanV2 = z.infer<typeof discoveryPlanV2Schema>;
export type SegmentProviderRouteV2 = z.infer<typeof segmentProviderRouteSchema>;

export function compileDiscoveryPlanV2(input: {
  id: string;
  workspaceId: string;
  strategy: CampaignStrategyV2;
  segments?: CampaignStrategyV2["discoverySegments"];
  marketResearchPlanVersionId?: string;
  routes: SegmentProviderRouteV2[];
  providerCapabilities: Array<z.infer<typeof discoveryProviderCapabilitiesSchema>>;
  versionNumber: number;
  marketBreadth?: DiscoveryPlanV2["marketBreadth"];
  estimatedCandidateRange?: DiscoveryPlanV2["estimatedCandidateRange"];
  maximumProviderCalls: number;
  maximumEstimatedCostMinor?: number;
  deadlineAt?: string;
  compiledAt: string;
}) {
  const strategy = campaignStrategyV2Schema.parse(input.strategy);
  if (strategy.status !== "confirmed") {
    throw new Error("Discovery planning requires a confirmed Campaign Strategy.");
  }
  const body = {
    schemaVersion: 2 as const,
    id: input.id,
    workspaceId: input.workspaceId,
    campaignId: strategy.campaignId,
    campaignStrategyVersionId: strategy.id,
    ...(input.marketResearchPlanVersionId
      ? { marketResearchPlanVersionId: input.marketResearchPlanVersionId }
      : {}),
    memorySnapshotId: strategy.memorySnapshotId,
    versionNumber: input.versionNumber,
    marketBreadth: input.marketBreadth ?? "medium",
    ...(input.estimatedCandidateRange
      ? { estimatedCandidateRange: input.estimatedCandidateRange }
      : {}),
    status: "ready" as const,
    segments: [...(input.segments ?? strategy.discoverySegments)].sort(
      (left, right) => left.priority - right.priority || compareText(left.id, right.id),
    ),
    routes: [...input.routes]
      .map((route) => ({
        ...route,
        providers: [...route.providers].sort(
          (left, right) =>
            left.priority - right.priority ||
            compareText(left.providerId, right.providerId),
        ),
      }))
      .sort((left, right) => compareText(left.segmentId, right.segmentId)),
    providerCapabilities: [...input.providerCapabilities]
      .map((capabilities) => ({
        providerId: capabilities.providerId,
        providerVersion: capabilities.providerVersion,
        capabilities,
        contentHash: hashCanonical(capabilities),
      }))
      .sort((left, right) => compareText(left.providerId, right.providerId)),
    coveragePolicy: {
      minimumCoverageConfidence: 0.65,
      minimumSourceDiversity: 2,
      requireLocalLanguageWhenAvailable: true,
    },
    stoppingPolicy: strategy.stoppingPolicy,
    budgetPolicy: {
      maximumProviderCalls: input.maximumProviderCalls,
      ...(input.maximumEstimatedCostMinor === undefined
        ? {}
        : { maximumEstimatedCostMinor: input.maximumEstimatedCostMinor }),
      ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}),
    },
    compiledAt: input.compiledAt,
  };
  return discoveryPlanV2Schema.parse({
    ...body,
    contentHash: hashCanonical(body),
  });
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

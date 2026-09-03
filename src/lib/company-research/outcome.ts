import { z } from "zod";

export const companyResearchCompletionReasonSchema = z.enum([
  "target_reached",
  "market_exhausted",
  "user_stopped",
  "internal_cost_guard",
  "provider_failure",
  "technical_failure",
]);
export const companyResearchStateSchema = z.enum([
  "active",
  "target_reached",
  "partial_complete",
  "stopped",
  "failed",
]);
export const deliveredQualificationLaneSchema = z.enum(["recommended", "conditional"]);

export const companyResearchOutcomeSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestedCompanyCount: z.number().int().min(1).max(500),
    deliveredCompanyCount: z.number().int().nonnegative(),
    state: companyResearchStateSchema,
    completionReason: companyResearchCompletionReasonSchema.nullable(),
  })
  .strict()
  .superRefine((outcome, context) => {
    if (outcome.deliveredCompanyCount > outcome.requestedCompanyCount)
      context.addIssue({
        code: "custom",
        path: ["deliveredCompanyCount"],
        message: "Delivered company count cannot exceed the requested outcome.",
      });
    if (outcome.state === "active" && outcome.completionReason !== null)
      context.addIssue({
        code: "custom",
        path: ["completionReason"],
        message: "Active research cannot have a completion reason.",
      });
    if (outcome.state !== "active" && outcome.completionReason === null)
      context.addIssue({
        code: "custom",
        path: ["completionReason"],
        message: "Terminal research requires a completion reason.",
      });
    if (
      outcome.completionReason === "target_reached" &&
      outcome.deliveredCompanyCount < outcome.requestedCompanyCount
    )
      context.addIssue({
        code: "custom",
        path: ["deliveredCompanyCount"],
        message: "Target reached requires the requested number of companies.",
      });
  });

export type CompanyResearchCompletionReason = z.infer<
  typeof companyResearchCompletionReasonSchema
>;
export type CompanyResearchState = z.infer<typeof companyResearchStateSchema>;
export type CompanyResearchOutcome = z.infer<typeof companyResearchOutcomeSchema>;

export function isDeliveredQualificationLane(lane: string) {
  return deliveredQualificationLaneSchema.safeParse(lane).success;
}

export function countDeliveredCompanies(
  candidates: ReadonlyArray<{ companyId: string | null; lane: string }>,
) {
  return new Set(
    candidates.flatMap((candidate) =>
      candidate.companyId && isDeliveredQualificationLane(candidate.lane)
        ? [candidate.companyId]
        : [],
    ),
  ).size;
}

export function activeCompanyResearchOutcome(input: {
  requestedCompanyCount: number;
  deliveredCompanyCount: number;
}): CompanyResearchOutcome {
  return companyResearchOutcomeSchema.parse({
    schemaVersion: 1,
    ...input,
    state: "active",
    completionReason: null,
  });
}

export function completeCompanyResearchOutcome(input: {
  requestedCompanyCount: number;
  deliveredCompanyCount: number;
  reason: CompanyResearchCompletionReason;
}): CompanyResearchOutcome {
  const state: CompanyResearchState =
    input.reason === "target_reached"
      ? "target_reached"
      : input.reason === "technical_failure"
        ? "failed"
        : input.reason === "user_stopped"
          ? "stopped"
          : "partial_complete";
  return companyResearchOutcomeSchema.parse({
    schemaVersion: 1,
    requestedCompanyCount: input.requestedCompanyCount,
    deliveredCompanyCount: Math.min(
      input.requestedCompanyCount,
      input.deliveredCompanyCount,
    ),
    state,
    completionReason: input.reason,
  });
}

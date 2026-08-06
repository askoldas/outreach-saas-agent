import { z } from "zod";

export const epistemicStatusSchema = z.enum([
  "explicit_fact",
  "evidence_backed_inference",
  "hypothesis",
  "unknown",
  "conflict",
]);

export const intelligenceClaimSchema = z
  .object({
    claimId: z.string().min(1),
    fieldPath: z.string().min(1),
    statement: z.string().min(1).max(1200),
    value: z.unknown().optional(),
    epistemicStatus: epistemicStatusSchema,
    confidence: z.number().min(0).max(1),
    evidenceIds: z.array(z.string().min(1)).max(20),
    counterEvidenceIds: z.array(z.string().min(1)).max(20).default([]),
    conciseRationale: z.string().max(600).optional(),
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.epistemicStatus === "explicit_fact" && claim.evidenceIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Explicit facts require evidence.",
        path: ["evidenceIds"],
      });
    }
    if (
      claim.epistemicStatus === "evidence_backed_inference" &&
      !claim.conciseRationale
    ) {
      context.addIssue({
        code: "custom",
        message: "Evidence-backed inferences require a rationale.",
        path: ["conciseRationale"],
      });
    }
    if (
      claim.epistemicStatus === "unknown" &&
      (claim.value !== undefined || claim.confidence !== 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Unknown claims cannot contain a value or non-zero confidence.",
        path: ["value"],
      });
    }
    if (
      claim.epistemicStatus === "conflict" &&
      claim.counterEvidenceIds.length === 0 &&
      !claim.conciseRationale
    ) {
      context.addIssue({
        code: "custom",
        message: "Conflicts require counter-evidence or an explanation.",
        path: ["counterEvidenceIds"],
      });
    }
  });

export type IntelligenceClaim = z.infer<typeof intelligenceClaimSchema>;

export function assertClaimEvidenceScope(
  claim: IntelligenceClaim,
  allowedEvidenceIds: ReadonlySet<string>,
) {
  for (const evidenceId of [...claim.evidenceIds, ...claim.counterEvidenceIds]) {
    if (!allowedEvidenceIds.has(evidenceId)) {
      throw new Error(
        `Claim ${claim.claimId} references unknown evidence ${evidenceId}.`,
      );
    }
  }
}

import { z } from "zod";

export const intelligenceRuleSchema = z
  .object({
    ruleKey: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    ruleType: z.enum([
      "positive_signal",
      "negative_signal",
      "hard_exclusion",
      "soft_exclusion",
      "requirement",
      "preference",
    ]),
    scope: z.enum(["workspace", "offering", "campaign", "candidate"]),
    strength: z.enum(["hard", "soft"]),
    applicability: z
      .object({
        objectives: z.array(z.string()).default([]),
        offeringIds: z.array(z.string()).default([]),
        geographies: z.array(z.string()).default([]),
        relationshipTypes: z.array(z.string()).default([]),
        archetypeIds: z.array(z.string()).default([]),
      })
      .strict(),
    status: z.enum(["proposed", "provisional", "confirmed", "rejected", "superseded"]),
    source: z.enum(["user", "profile", "campaign", "ai", "system"]),
    evidenceIds: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.source === "ai" && !["proposed", "provisional"].includes(rule.status)) {
      context.addIssue({
        code: "custom",
        message: "AI may create only proposed or provisional rules.",
        path: ["status"],
      });
    }
    if (rule.ruleType === "hard_exclusion" && rule.strength !== "hard") {
      context.addIssue({
        code: "custom",
        message: "Hard exclusions must have hard strength.",
        path: ["strength"],
      });
    }
  });

export type IntelligenceRule = z.infer<typeof intelligenceRuleSchema>;

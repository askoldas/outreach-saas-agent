import { z } from "zod";

export const intelligenceArtifactVersionSchema = z
  .object({
    schemaVersion: z.string().min(1),
    compilerVersion: z.string().min(1),
    inputHash: z.string().length(64),
    contentHash: z.string().length(64),
    createdAt: z.iso.datetime(),
    promptVersion: z.string().min(1).optional(),
    modelRole: z.string().min(1).optional(),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((version, context) => {
    const modelFields = [version.modelRole, version.provider, version.model];
    if (modelFields.some(Boolean) && modelFields.some((value) => !value)) {
      context.addIssue({
        code: "custom",
        message: "AI-derived artifacts require model role, provider, and model together.",
        path: ["modelRole"],
      });
    }
  });

export type IntelligenceArtifactVersion = z.infer<
  typeof intelligenceArtifactVersionSchema
>;

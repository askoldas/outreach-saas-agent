import { z } from "zod";

export const confidenceSchema = z.number().min(0).max(1);
export const referenceIdSchema = z.string().min(1).max(200);

export const geographyScopeSchema = z
  .object({
    displayName: z.string().min(1).max(240),
    countryCodes: z.array(z.string().min(2).max(3)).min(1),
    regions: z.array(z.string().min(1).max(160)).default([]),
    cities: z.array(z.string().min(1).max(160)).default([]),
    localLanguages: z.array(z.string().min(1).max(80)).default([]),
    workingLanguages: z.array(z.string().min(1).max(80)).min(1),
  })
  .strict();

export const signalSchema = z
  .object({
    key: referenceIdSchema,
    statement: z.string().min(1).max(800),
    evidenceIds: z.array(referenceIdSchema).max(30).default([]),
    confidence: confidenceSchema,
  })
  .strict();

export const typedCommercialSignalSchema = signalSchema.extend({
  type: z.enum(["scale_driver", "buying_trigger", "need_signal"]),
  label: z.string().min(1).max(400),
});

export const unknownSchema = z
  .object({
    key: referenceIdSchema,
    question: z.string().min(1).max(600),
    importance: z.enum(["critical", "important", "optional"]),
  })
  .strict();

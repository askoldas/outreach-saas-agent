import { z } from "zod";

export const evolvingMarketOverviewSchema = z.object({
  schemaVersion: z.literal(1),
  cycleNumber: z.number().int().positive(),
  summary: z.string().min(1),
  localTerminology: z.array(z.object({ term: z.string(), meaning: z.string() })),
  sourceFamilies: z.array(z.string()),
  observations: z.array(z.object({ cycleNumber: z.number().int().positive(), statement: z.string().min(1) })),
  exploredDirectionCount: z.number().int().nonnegative(),
  nextDirection: z.string().nullable(),
  saturationState: z.enum(["active", "low_yield", "saturated", "paused", "complete"]),
  updatedAt: z.string(),
});

export type EvolvingMarketOverview = z.infer<typeof evolvingMarketOverviewSchema>;

import type { z } from "zod";
import { excludedMemorySchema, memoryRetrievalContextSchema } from "./contracts.ts";

export type MemoryRetrievalContext = z.infer<typeof memoryRetrievalContextSchema>;
export type ExcludedMemory = z.infer<typeof excludedMemorySchema>;

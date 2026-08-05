import { createHash } from "node:crypto";

export type IntelligenceCacheIdentity = {
  taskId: string;
  frozenInputHash: string;
  promptVersion: string;
  schemaVersion: string;
  contextCompilerVersion: string;
  modelRouteVersion: string;
};

export function intelligenceResultCacheKey(input: IntelligenceCacheIdentity) {
  return createHash("sha256")
    .update(
      [
        input.taskId,
        input.frozenInputHash,
        input.promptVersion,
        input.schemaVersion,
        input.contextCompilerVersion,
        input.modelRouteVersion,
      ].join("\u001f"),
    )
    .digest("hex");
}

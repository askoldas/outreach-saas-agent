import {
  parseTargetSegments,
  type TargetSegment,
} from "../campaign-workflow/target-segments.ts";

export const targetSegmentProposalPromptVersion = "campaign-target-segments-v1";

export function parseTargetSegmentProposalResponse(value: unknown): TargetSegment[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Target proposal returned an invalid response.");
  }
  return parseTargetSegments((parsed as Record<string, unknown>).targetSegments);
}

function parseJson(value: string) {
  try {
    return JSON.parse(
      value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error("Target proposal returned invalid JSON.");
  }
}

import {
  campaignStrategyV2Schema,
  type CampaignStrategyV2,
} from "./schemas.ts";

const compiledDraftStates = new Set(["ready_for_review", "confirmed"]);
const recoverableDraftStates = new Set(["needs_input", "failed"]);

export function parseCampaignStrategyV2DraftPayload(
  state: string,
  value: unknown,
): CampaignStrategyV2 | null {
  if (!compiledDraftStates.has(state)) return null;
  return campaignStrategyV2Schema.parse(value);
}

export function canRetryCampaignStrategyV2Draft(state: string) {
  return recoverableDraftStates.has(state);
}

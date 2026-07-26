import assert from "node:assert/strict";
import test from "node:test";
import { isCampaignAgentEnabled } from "./feature-flag.ts";

test("Campaign Agent is disabled unless explicitly enabled", () => {
  const previous = process.env.CAMPAIGN_AGENT_ENABLED;
  delete process.env.CAMPAIGN_AGENT_ENABLED;
  assert.equal(isCampaignAgentEnabled(), false);
  process.env.CAMPAIGN_AGENT_ENABLED = "true";
  assert.equal(isCampaignAgentEnabled(), true);
  process.env.CAMPAIGN_AGENT_ENABLED = "invalid";
  assert.throws(() => isCampaignAgentEnabled(), /must be true or false/);
  if (previous === undefined) delete process.env.CAMPAIGN_AGENT_ENABLED;
  else process.env.CAMPAIGN_AGENT_ENABLED = previous;
});

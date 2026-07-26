export function isCampaignAgentEnabled() {
  const value = process.env.CAMPAIGN_AGENT_ENABLED?.trim().toLowerCase();
  if (!value || value === "false") return false;
  if (value === "true") return true;
  throw new Error("CAMPAIGN_AGENT_ENABLED must be true or false.");
}

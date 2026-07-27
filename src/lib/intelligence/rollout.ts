import {
  assertValidIntelligenceRollout,
  getIntelligenceFeatureFlags,
  type IntelligenceFeatureFlags,
} from "./feature-flags.ts";

export const intelligenceVersions = ["v1", "v2"] as const;
export type IntelligenceVersion = (typeof intelligenceVersions)[number];

export const intelligenceResultWriteModes = ["none", "shadow", "canonical"] as const;
export type IntelligenceResultWriteMode = (typeof intelligenceResultWriteModes)[number];

export type WorkspaceIntelligenceSettings = {
  campaignWorkflow: IntelligenceVersion;
  enabledProviders: string[];
  profileVersion: IntelligenceVersion;
  resultWriteMode: IntelligenceResultWriteMode;
  shadowMode: boolean;
};

export const defaultWorkspaceIntelligenceSettings: WorkspaceIntelligenceSettings = {
  campaignWorkflow: "v1",
  enabledProviders: ["web"],
  profileVersion: "v1",
  resultWriteMode: "none",
  shadowMode: false,
};

export function resolveWorkspaceIntelligenceSettings(input: {
  environment?: Record<string, string | undefined>;
  settings?: Partial<WorkspaceIntelligenceSettings> | null;
}): WorkspaceIntelligenceSettings {
  const flags = getIntelligenceFeatureFlags(input.environment);
  assertValidIntelligenceRollout(flags);
  const settings = parseWorkspaceIntelligenceSettings(input.settings);
  if (!flags.INTELLIGENCE_V2_ENABLED) return defaultWorkspaceIntelligenceSettings;
  return {
    ...settings,
    profileVersion: flags.INTELLIGENCE_V2_PROFILE_ENABLED
      ? settings.profileVersion
      : "v1",
    campaignWorkflow: flags.INTELLIGENCE_V2_STRATEGY_ENABLED
      ? settings.campaignWorkflow
      : "v1",
    shadowMode: flags.INTELLIGENCE_V2_SHADOW_MODE && settings.shadowMode,
    resultWriteMode: resolveWriteMode(flags, settings.resultWriteMode),
    enabledProviders: settings.enabledProviders.filter((provider) =>
      providerEnabled(flags, provider),
    ),
  };
}

export function parseWorkspaceIntelligenceSettings(
  value?: Partial<WorkspaceIntelligenceSettings> | null,
): WorkspaceIntelligenceSettings {
  const profileVersion = value?.profileVersion ?? "v1";
  const campaignWorkflow = value?.campaignWorkflow ?? "v1";
  const resultWriteMode = value?.resultWriteMode ?? "none";
  const enabledProviders = value?.enabledProviders ?? ["web"];
  if (!intelligenceVersions.includes(profileVersion))
    throw new Error("Unsupported workspace profile intelligence version.");
  if (!intelligenceVersions.includes(campaignWorkflow))
    throw new Error("Unsupported workspace campaign workflow version.");
  if (!intelligenceResultWriteModes.includes(resultWriteMode))
    throw new Error("Unsupported Intelligence V2 result write mode.");
  if (
    !Array.isArray(enabledProviders) ||
    enabledProviders.some((provider) => typeof provider !== "string" || !provider.trim())
  )
    throw new Error("Enabled discovery providers must be non-empty strings.");
  return {
    campaignWorkflow,
    enabledProviders: [...new Set(enabledProviders.map((provider) => provider.trim()))],
    profileVersion,
    resultWriteMode,
    shadowMode: value?.shadowMode === true,
  };
}

function resolveWriteMode(
  flags: IntelligenceFeatureFlags,
  requested: IntelligenceResultWriteMode,
): IntelligenceResultWriteMode {
  if (requested === "canonical" && !flags.INTELLIGENCE_V2_WRITE_RESULTS)
    return flags.INTELLIGENCE_V2_SHADOW_MODE ? "shadow" : "none";
  if (requested === "shadow" && !flags.INTELLIGENCE_V2_SHADOW_MODE) return "none";
  return requested;
}

function providerEnabled(flags: IntelligenceFeatureFlags, provider: string) {
  const providerFlags: Record<string, boolean> = {
    web: flags.DISCOVERY_PROVIDER_WEB_ENABLED,
    pdl: flags.DISCOVERY_PROVIDER_PDL_ENABLED,
    apollo: flags.DISCOVERY_PROVIDER_APOLLO_ENABLED,
    coresignal: flags.DISCOVERY_PROVIDER_CORESIGNAL_ENABLED,
  };
  return providerFlags[provider] === true;
}

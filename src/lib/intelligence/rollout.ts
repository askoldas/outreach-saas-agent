import {
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
  campaignWorkflow: "v2",
  enabledProviders: ["web"],
  profileVersion: "v2",
  resultWriteMode: "canonical",
  shadowMode: false,
};

export function resolveWorkspaceIntelligenceSettings(input: {
  environment?: Record<string, string | undefined>;
  settings?: Partial<WorkspaceIntelligenceSettings> | null;
}): WorkspaceIntelligenceSettings {
  const flags = getIntelligenceFeatureFlags(input.environment);
  const settings = parseWorkspaceIntelligenceSettings(input.settings);
  return {
    ...settings,
    profileVersion: "v2",
    campaignWorkflow: "v2",
    shadowMode: false,
    resultWriteMode: "canonical",
    enabledProviders: settings.enabledProviders.filter((provider) =>
      providerEnabled(flags, provider),
    ),
  };
}

export function parseWorkspaceIntelligenceSettings(
  value?: Partial<WorkspaceIntelligenceSettings> | null,
): WorkspaceIntelligenceSettings {
  const profileVersion = value?.profileVersion ?? "v2";
  const campaignWorkflow = value?.campaignWorkflow ?? "v2";
  const resultWriteMode = value?.resultWriteMode ?? "canonical";
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

function providerEnabled(flags: IntelligenceFeatureFlags, provider: string) {
  const providerFlags: Record<string, boolean> = {
    web: flags.DISCOVERY_PROVIDER_WEB_ENABLED,
    pdl: flags.DISCOVERY_PROVIDER_PDL_ENABLED,
    apollo: flags.DISCOVERY_PROVIDER_APOLLO_ENABLED,
    coresignal: flags.DISCOVERY_PROVIDER_CORESIGNAL_ENABLED,
  };
  return providerFlags[provider] === true;
}

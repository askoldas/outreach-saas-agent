export const intelligenceFeatureFlagNames = [
  "INTELLIGENCE_V2_ENABLED",
  "INTELLIGENCE_V2_PROFILE_ENABLED",
  "INTELLIGENCE_V2_STRATEGY_ENABLED",
  "INTELLIGENCE_V2_DISCOVERY_ENABLED",
  "INTELLIGENCE_V2_EVALUATION_ENABLED",
  "INTELLIGENCE_V2_RANKING_ENABLED",
  "INTELLIGENCE_V2_SHADOW_MODE",
  "INTELLIGENCE_V2_WRITE_RESULTS",
  "DISCOVERY_PROVIDER_WEB_ENABLED",
  "DISCOVERY_PROVIDER_PDL_ENABLED",
  "DISCOVERY_PROVIDER_APOLLO_ENABLED",
  "DISCOVERY_PROVIDER_CORESIGNAL_ENABLED",
] as const;

export type IntelligenceFeatureFlagName = (typeof intelligenceFeatureFlagNames)[number];

export type IntelligenceFeatureFlags = Record<IntelligenceFeatureFlagName, boolean>;

const defaults: IntelligenceFeatureFlags = {
  INTELLIGENCE_V2_ENABLED: true,
  INTELLIGENCE_V2_PROFILE_ENABLED: true,
  INTELLIGENCE_V2_STRATEGY_ENABLED: true,
  INTELLIGENCE_V2_DISCOVERY_ENABLED: true,
  INTELLIGENCE_V2_EVALUATION_ENABLED: true,
  INTELLIGENCE_V2_RANKING_ENABLED: true,
  INTELLIGENCE_V2_SHADOW_MODE: false,
  INTELLIGENCE_V2_WRITE_RESULTS: true,
  DISCOVERY_PROVIDER_WEB_ENABLED: true,
  DISCOVERY_PROVIDER_PDL_ENABLED: false,
  DISCOVERY_PROVIDER_APOLLO_ENABLED: false,
  DISCOVERY_PROVIDER_CORESIGNAL_ENABLED: false,
};

export function getIntelligenceFeatureFlags(
  environment: Record<string, string | undefined> = process.env,
): IntelligenceFeatureFlags {
  return Object.fromEntries(
    intelligenceFeatureFlagNames.map((name) => [
      name,
      parseBooleanFlag(name, environment[name], defaults[name]),
    ]),
  ) as IntelligenceFeatureFlags;
}

export function assertValidIntelligenceRollout(flags: IntelligenceFeatureFlags) {
  const stageFlags = [
    flags.INTELLIGENCE_V2_PROFILE_ENABLED,
    flags.INTELLIGENCE_V2_STRATEGY_ENABLED,
    flags.INTELLIGENCE_V2_DISCOVERY_ENABLED,
    flags.INTELLIGENCE_V2_EVALUATION_ENABLED,
    flags.INTELLIGENCE_V2_RANKING_ENABLED,
    flags.INTELLIGENCE_V2_SHADOW_MODE,
    flags.INTELLIGENCE_V2_WRITE_RESULTS,
  ];
  if (!flags.INTELLIGENCE_V2_ENABLED && stageFlags.some(Boolean))
    throw new Error(
      "INTELLIGENCE_V2_ENABLED must be true before an Intelligence V2 stage is enabled.",
    );
  if (flags.INTELLIGENCE_V2_WRITE_RESULTS && !flags.INTELLIGENCE_V2_DISCOVERY_ENABLED)
    throw new Error(
      "INTELLIGENCE_V2_DISCOVERY_ENABLED must be true before V2 result writes are enabled.",
    );
  if (
    flags.INTELLIGENCE_V2_DISCOVERY_ENABLED &&
    !flags.DISCOVERY_PROVIDER_WEB_ENABLED &&
    !flags.DISCOVERY_PROVIDER_PDL_ENABLED &&
    !flags.DISCOVERY_PROVIDER_APOLLO_ENABLED &&
    !flags.DISCOVERY_PROVIDER_CORESIGNAL_ENABLED
  )
    throw new Error("At least one discovery provider must be enabled for V2 discovery.");
}

function parseBooleanFlag(
  name: IntelligenceFeatureFlagName,
  value: string | undefined,
  fallback: boolean,
) {
  if (value === undefined || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

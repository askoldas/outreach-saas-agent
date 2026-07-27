import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidIntelligenceRollout,
  getIntelligenceFeatureFlags,
} from "./feature-flags.ts";
import {
  defaultWorkspaceIntelligenceSettings,
  resolveWorkspaceIntelligenceSettings,
} from "./rollout.ts";

test("Intelligence V2 and future discovery providers are disabled by default", () => {
  const flags = getIntelligenceFeatureFlags({});
  assert.equal(flags.INTELLIGENCE_V2_ENABLED, false);
  assert.equal(flags.INTELLIGENCE_V2_WRITE_RESULTS, false);
  assert.equal(flags.DISCOVERY_PROVIDER_WEB_ENABLED, true);
  assert.equal(flags.DISCOVERY_PROVIDER_PDL_ENABLED, false);
});

test("feature flag registry rejects invalid booleans and unsafe dependencies", () => {
  assert.throws(
    () => getIntelligenceFeatureFlags({ INTELLIGENCE_V2_ENABLED: "yes" }),
    /must be true or false/,
  );
  assert.throws(
    () =>
      assertValidIntelligenceRollout(
        getIntelligenceFeatureFlags({
          INTELLIGENCE_V2_ENABLED: "false",
          INTELLIGENCE_V2_PROFILE_ENABLED: "true",
        }),
      ),
    /must be true/,
  );
});

test("workspace V2 selection cannot override disabled deployment stages", () => {
  assert.deepEqual(
    resolveWorkspaceIntelligenceSettings({
      environment: {},
      settings: {
        campaignWorkflow: "v2",
        profileVersion: "v2",
        resultWriteMode: "canonical",
        shadowMode: true,
      },
    }),
    defaultWorkspaceIntelligenceSettings,
  );
});

test("workspace rollout remains stage-level and result writes require their gate", () => {
  const settings = resolveWorkspaceIntelligenceSettings({
    environment: {
      INTELLIGENCE_V2_ENABLED: "true",
      INTELLIGENCE_V2_PROFILE_ENABLED: "true",
      INTELLIGENCE_V2_STRATEGY_ENABLED: "true",
      INTELLIGENCE_V2_SHADOW_MODE: "true",
    },
    settings: {
      campaignWorkflow: "v2",
      enabledProviders: ["web", "apollo"],
      profileVersion: "v2",
      resultWriteMode: "canonical",
      shadowMode: true,
    },
  });
  assert.equal(settings.profileVersion, "v2");
  assert.equal(settings.campaignWorkflow, "v2");
  assert.equal(settings.resultWriteMode, "shadow");
  assert.equal(settings.shadowMode, true);
  assert.deepEqual(settings.enabledProviders, ["web"]);
});

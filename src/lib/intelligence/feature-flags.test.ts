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

test("Intelligence V2 is canonical while future discovery providers remain disabled", () => {
  const flags = getIntelligenceFeatureFlags({});
  assert.equal(flags.INTELLIGENCE_V2_ENABLED, true);
  assert.equal(flags.INTELLIGENCE_V2_WRITE_RESULTS, true);
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

test("workspace routing cannot downgrade the canonical V2 default", () => {
  assert.deepEqual(
    resolveWorkspaceIntelligenceSettings({
      environment: {
        INTELLIGENCE_V2_ENABLED: "false",
        INTELLIGENCE_V2_PROFILE_ENABLED: "false",
        INTELLIGENCE_V2_STRATEGY_ENABLED: "false",
        INTELLIGENCE_V2_DISCOVERY_ENABLED: "false",
        INTELLIGENCE_V2_EVALUATION_ENABLED: "false",
        INTELLIGENCE_V2_RANKING_ENABLED: "false",
        INTELLIGENCE_V2_WRITE_RESULTS: "false",
      },
      settings: {
        campaignWorkflow: "v1",
        profileVersion: "v1",
        resultWriteMode: "none",
        shadowMode: true,
      },
    }),
    defaultWorkspaceIntelligenceSettings,
  );
});

test("workspace settings remain canonical and provider availability stays explicit", () => {
  const settings = resolveWorkspaceIntelligenceSettings({
    environment: {
      INTELLIGENCE_V2_ENABLED: "true",
      INTELLIGENCE_V2_PROFILE_ENABLED: "true",
      INTELLIGENCE_V2_STRATEGY_ENABLED: "true",
      INTELLIGENCE_V2_DISCOVERY_ENABLED: "true",
      INTELLIGENCE_V2_EVALUATION_ENABLED: "true",
      INTELLIGENCE_V2_RANKING_ENABLED: "true",
      INTELLIGENCE_V2_WRITE_RESULTS: "true",
    },
    settings: {
      campaignWorkflow: "v2",
      enabledProviders: ["web", "apollo"],
      profileVersion: "v2",
      resultWriteMode: "canonical",
      shadowMode: false,
    },
  });
  assert.equal(settings.profileVersion, "v2");
  assert.equal(settings.campaignWorkflow, "v2");
  assert.equal(settings.resultWriteMode, "canonical");
  assert.equal(settings.shadowMode, false);
  assert.deepEqual(settings.enabledProviders, ["web"]);
});

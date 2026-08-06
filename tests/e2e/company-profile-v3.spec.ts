import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("reviews, edits, and publishes a V3 Company Profile", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const email = `profile-v3-${suffix}@example.com`;
  const password = "Opptium-test-2026";
  const workspaceName = `Profile V3 ${suffix}`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding\/workspace/);
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByLabel("Website URL").fill("https://profile-v3.example.com");
  await page.getByRole("button", { name: "Create workspace" }).click();

  const seeded = await seedV3Review(workspaceName, suffix);
  await page.goto("/company-profile");
  if (
    !(await page
      .getByRole("heading", { name: "Company Intelligence review" })
      .isVisible())
  ) {
    test.skip(true, "Deployment-level Intelligence V2 profile flags are disabled.");
  }

  await page.getByLabel("Public company name").fill("Reviewed Example Company");
  await page.getByLabel("Canonical domain").fill("reviewed.example.com");
  await page
    .getByLabel("Commercial summary")
    .fill("Reviewed recurring software and implementation business.");
  await page.getByLabel("Primary role").fill("software_provider");
  await page.getByRole("button", { name: "Save reviewed core" }).click();
  await expect(
    page.getByText("Reviewed Company Intelligence fields were saved."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Confirm" }).first().click();
  await page.getByRole("button", { name: "Confirm" }).last().click();
  await page.getByRole("button", { name: "Publish V3 profile" }).click();
  await expect(
    page.getByText(
      "Company Intelligence V3 was published as an immutable profile version.",
    ),
  ).toBeVisible();

  const supabase = serviceClient();
  const { data: draft, error: draftError } = await supabase
    .from("company_profile_drafts")
    .select("state")
    .eq("id", seeded.draftId)
    .single();
  if (draftError) throw draftError;
  expect(draft.state).toBe("approved");
  const { data: version, error: versionError } = await supabase
    .from("company_profile_versions")
    .select("intelligence_version,profile_status")
    .eq("workspace_id", seeded.workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (versionError) throw versionError;
  expect(version).toEqual({
    intelligence_version: "v2",
    profile_status: "published",
  });
});

async function seedV3Review(workspaceName: string, suffix: string) {
  const supabase = serviceClient();
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("name", workspaceName)
    .single();
  if (workspaceError) throw workspaceError;
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("id")
    .eq("workspace_id", workspace.id)
    .single();
  if (profileError) throw profileError;
  const { error: settingsError } = await supabase
    .from("workspace_intelligence_settings")
    .update({ profile_version: "v2" })
    .eq("workspace_id", workspace.id);
  if (settingsError) throw settingsError;
  const { data: draft, error: draftError } = await supabase
    .from("company_profile_drafts")
    .insert({
      workspace_id: workspace.id,
      company_profile_id: profile.id,
      state: "ready_for_review",
      input_hash: `e2e-${suffix}`,
      compiled_snapshot_json: {
        identity: {
          publicName: "Example Company",
          canonicalDomain: "profile-v3.example.com",
        },
        commercialSynthesis: {
          conciseCommercialSummary: "Recurring software business.",
        },
      },
    })
    .select("id")
    .single();
  if (draftError) throw draftError;
  const { error: profileUpdateError } = await supabase
    .from("company_profiles")
    .update({ current_v3_draft_id: draft.id })
    .eq("id", profile.id);
  if (profileUpdateError) throw profileUpdateError;
  const { error: modelError } = await supabase.from("company_business_models").insert({
    workspace_id: workspace.id,
    profile_draft_id: draft.id,
    primary_role: "software_provider",
    revenue_model: "subscription",
    transaction_model: "subscription",
    customer_usage_mode: "use",
    structured_details_json: {
      conciseCommercialSummary: "Recurring software business.",
    },
    confidence: 0.8,
  });
  if (modelError) throw modelError;
  const { data: offering, error: offeringError } = await supabase
    .from("company_offerings")
    .insert({
      workspace_id: workspace.id,
      company_profile_id: profile.id,
      stable_key: `platform-${suffix}`,
    })
    .select("id")
    .single();
  if (offeringError) throw offeringError;
  const { data: offeringVersion, error: offeringVersionError } = await supabase
    .from("company_offering_versions")
    .insert({
      workspace_id: workspace.id,
      company_offering_id: offering.id,
      profile_draft_id: draft.id,
      slug: `platform-${suffix}`,
      name: "Operations platform",
      status: "active",
      offering_type: "software",
      short_description: "A recurring operations platform.",
      commercial_mechanics_json: {
        customerProblems: ["Operational complexity"],
        expectedOutcomes: ["Simpler operations"],
      },
      buyer_logic_json: { whyBuy: ["Simpler operations"] },
      relationship_options_json: [],
      constraints_json: [],
      confidence: 0.8,
    })
    .select("id")
    .single();
  if (offeringVersionError) throw offeringVersionError;
  const { error: archetypeError } = await supabase
    .from("buyer_archetype_hypotheses")
    .insert({
      workspace_id: workspace.id,
      profile_draft_id: draft.id,
      offering_version_id: offeringVersion.id,
      archetype_key: `operator-${suffix}`,
      name: "Operations teams",
      relationship_type: "direct_buyer",
      priority: "priority",
      status: "proposed",
      structured_details_json: { whyCompatible: ["Uses the platform directly"] },
      confidence: 0.8,
    });
  if (archetypeError) throw archetypeError;
  const { error: ruleError } = await supabase.from("commercial_rules").insert({
    workspace_id: workspace.id,
    profile_draft_id: draft.id,
    rule_key: `business-only-${suffix}`,
    scope: "workspace",
    scope_id: workspace.id,
    rule_type: "requirement",
    strength: "soft",
    status: "proposed",
    source: "ai",
    description: "Prioritize organizations with operational teams.",
    confidence: 0.7,
  });
  if (ruleError) throw ruleError;
  return { draftId: draft.id, workspaceId: workspace.id };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("Disposable Supabase service configuration is required.");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

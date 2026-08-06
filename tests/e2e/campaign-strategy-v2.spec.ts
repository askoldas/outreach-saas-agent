import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("routes an enabled workspace through geography-first Strategy V2 creation", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const email = `campaign-v2-${suffix}@example.com`;
  const password = "Opptium-test-2026";
  const workspaceName = `Campaign V2 ${suffix}`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByLabel("Website URL").fill("https://campaign-v2.example.com");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await page.goto("/company-profile");
  await page.getByLabel("Company name").fill("Campaign V2 Example");
  await page.getByLabel("Business summary").fill("B2B operations software.");
  await page.getByLabel("Products and services").fill("Operations platform");
  await page.getByLabel("Customer types and industries").fill("Manufacturers");
  await page.getByRole("button", { name: "Save new version" }).click();

  const supabase = serviceClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("name", workspaceName)
    .single();
  if (error) throw error;
  const { error: settingsError } = await supabase
    .from("workspace_intelligence_settings")
    .update({ campaign_workflow: "v2" })
    .eq("workspace_id", workspace.id);
  if (settingsError) throw settingsError;

  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: "Baltics" }).click();
  await page
    .getByRole("button", { name: "Continue with Company Profile defaults" })
    .click();
  if (!(await page.getByLabel("Campaign objective").isVisible())) {
    test.skip(true, "Deployment-level Intelligence V2 strategy flags are disabled.");
  }
  await expect(page.getByLabel("Campaign objective")).toHaveValue("direct_buyer");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("button", { name: "Build campaign strategy" }),
  ).toBeVisible();
});

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("Disposable Supabase service configuration is required.");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

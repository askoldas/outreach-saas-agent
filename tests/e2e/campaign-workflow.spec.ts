import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("unauthenticated workspace routes require sign in", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Find and reach the B2B leads that actually fit your business.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close authentication" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("creates a workspace, profile version, and campaign strategy", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const email = `browser-${suffix}@example.com`;
  const password = "Opptium-test-2026";
  const workspace = `Browser Workspace ${suffix}`;
  const campaign = `Industrial services ${suffix}`;

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding\/workspace/);

  await page.getByLabel("Workspace name").fill(workspace);
  await page.getByLabel("Website URL").fill("https://opptium-e2e.example.com");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(workspace, { exact: false }).first()).toBeVisible();

  await page.goto("/company-profile");
  await page.getByLabel("Company name").fill("Example Industrial Systems");
  await page.getByLabel("Business summary").fill("Industrial maintenance services.");
  await page.getByLabel("Products and services").fill("Preventive maintenance");
  await page.getByLabel("Customer types and industries").fill("Manufacturers");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(
    page.getByRole("heading", { name: "Example Industrial Systems" }),
  ).toBeVisible();

  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill(campaign);
  await page
    .getByLabel("Campaign brief")
    .fill("Manufacturers needing preventive maintenance.");
  await page.getByLabel("Country or region").fill("Northern Europe");
  await page.getByLabel("Desired companies").fill("5");
  await page.getByRole("button", { name: "Create campaign strategy" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);
  const campaignId = new URL(page.url()).pathname.split("/").at(-1);
  expect(campaignId).toBeTruthy();
  await expect(page.getByRole("heading", { name: campaign })).toBeVisible();
  await page.getByRole("link", { name: /Strategy/ }).click();
  await expect(page.getByText(/Strategy version 1/)).toBeVisible();
  await expect(page.getByLabel("Target geography")).toHaveValue("Northern Europe");

  await seedCompletedOutreachState({
    campaignId: campaignId!,
    suffix,
    workspaceName: workspace,
  });
  await page.goto(`/campaigns/${campaignId}/outreach?view=contacts`);
  await expect(page.getByText("Synthetic Components", { exact: true })).toBeVisible();
  await expect(
    page.getByText("sales@synthetic.example.com", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("source_confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept recommended selections" }).click();
  await expect(page.getByText(/Saved 1 recipient selection/)).toBeVisible();

  await page.getByRole("button", { name: "Drafts" }).click();
  const subject = page.getByLabel("Subject for sales@synthetic.example.com");
  await expect(subject).toHaveValue("Maintenance planning");
  await subject.fill("Updated maintenance planning");
  await page.getByRole("button", { name: "Save draft edits" }).click();
  await expect(page.getByText("Draft edits saved")).toBeVisible();

  await page.getByRole("button", { name: "Exports" }).click();
  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Outreach CSV" }).click();
  await firstDownload;
  await page.reload();
  const historicalDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download frozen CSV" }).first().click();
  const frozenFile = await historicalDownload;
  expect(frozenFile.suggestedFilename()).toBe("opptium-outreach.csv");
});

async function seedCompletedOutreachState(input: {
  campaignId: string;
  suffix: string;
  workspaceName: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("Disposable Supabase service configuration is required.");
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("name", input.workspaceName)
    .single();
  if (workspaceError) throw workspaceError;
  const leadExternalId = `e2e-lead-${input.suffix}`;
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      workspace_id: workspace.id,
      external_id: leadExternalId,
      company: "Synthetic Components",
      website: "https://synthetic.example.com",
      country: "Finland",
      city: "Helsinki",
      campaign_id: input.campaignId,
      company_type: "Manufacturer",
      industry: "Industrial components",
      estimated_size: "50-200 employees",
      description: "Synthetic browser-test company",
      fit_score: 88,
      confidence: "high",
      contactability: "high",
      status: "approved",
      summary: "Public evidence indicates a maintenance-relevant manufacturer.",
    })
    .select("id")
    .single();
  if (leadError) throw leadError;
  const { data: contact, error: contactError } = await supabase
    .from("lead_contact_routes")
    .insert({
      lead_id: lead.id,
      type: "Email",
      value: "sales@synthetic.example.com",
      suggested_role: "Sales department",
      verification: "source_confirmed",
      source: "https://synthetic.example.com/contact",
      sort_order: 0,
      verification_provider: "synthetic_e2e",
      verification_source_url: "https://synthetic.example.com/contact",
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (contactError) throw contactError;
  const { error: evidenceError } = await supabase.from("lead_evidence_claims").insert({
    lead_id: lead.id,
    external_id: "e2e-public-evidence",
    kind: "fact",
    text: "The company publicly describes industrial component manufacturing.",
    source_type: "synthetic_e2e",
    source_label: "Synthetic company page",
    source_url: "https://synthetic.example.com/about",
    retrieved_at: "2026-07-19",
    confidence: "high",
    sort_order: 0,
  });
  if (evidenceError) throw evidenceError;
  const { error: stateError } = await supabase.from("lead_outreach_states").upsert({
    workspace_id: workspace.id,
    lead_id: lead.id,
    enrichment_status: "contacts_ready",
    selected_contact_route_id: contact.id,
    selection_status: "accepted",
    recommendation_reason: "Synthetic accepted recipient",
  });
  if (stateError) throw stateError;
  const { error: draftError } = await supabase.from("outreach_drafts").insert({
    workspace_id: workspace.id,
    external_id: `e2e-draft-${input.suffix}`,
    lead_external_id: leadExternalId,
    campaign_external_id: input.campaignId,
    recipient_route: "sales@synthetic.example.com",
    subject: "Maintenance planning",
    body: "Hello, this is a grounded synthetic browser-test draft.",
    variant: "primary",
    language: "English",
    status: "needs_review",
    seller_claims: ["Preventive maintenance"],
    evidence_used: ["e2e-public-evidence"],
    warnings: [],
    prompt_version: "synthetic-e2e-v1",
    generated_at: new Date().toISOString(),
  });
  if (draftError) throw draftError;
}

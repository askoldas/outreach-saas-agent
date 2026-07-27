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
  await page.getByRole("button", { name: "Nordics" }).click();
  await page
    .getByRole("button", { name: "Continue with Company Profile defaults" })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Campaign name").fill(campaign);
  await page.getByLabel("Qualified companies wanted").fill("5");
  await page.getByRole("button", { name: "Start campaign" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);
  const campaignId = new URL(page.url()).pathname.split("/").at(-1);
  expect(campaignId).toBeTruthy();
  await expect(page.getByRole("heading", { name: campaign })).toBeVisible();
  await page.getByRole("link", { name: /Strategy/ }).click();
  await expect(page.getByText(/Strategy version 1/)).toBeVisible();
  await expect(page.getByLabel("Target geography")).toHaveValue("Northern Europe");

  await seedCleanWorkflowState({
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

async function seedCleanWorkflowState(input: {
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
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,profile_snapshot_id,current_strategy_version_id")
    .eq("workspace_id", workspace.id)
    .eq("external_id", input.campaignId)
    .single();
  if (campaignError) throw campaignError;
  if (!campaign.profile_snapshot_id || !campaign.current_strategy_version_id)
    throw new Error("Campaign did not freeze its profile and strategy.");

  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      profile_snapshot_id: campaign.profile_snapshot_id,
      strategy_version_id: campaign.current_strategy_version_id,
      status: "completed",
      current_phase: "ready_for_review",
      progress_percentage: 100,
      companies_discovered: 1,
      companies_qualified: 1,
      contacts_found: 1,
      candidates_discovered: 1,
      candidates_unique: 1,
      candidates_classified: 1,
      companies_evaluated: 1,
      completed_at: new Date().toISOString(),
      dispatch_state: "completed",
      dispatch_key: `e2e:${input.suffix}`,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  const { data: market, error: marketError } = await supabase
    .from("market_analyses")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      campaign_run_id: run.id,
      version: 1,
      analysis: { market: "Nordics", source: "deterministic_e2e" },
      prompt_version: "deterministic-e2e-v1",
      requested_model: "fixture",
      actual_model: "fixture",
      confidence: 1,
    })
    .select("id")
    .single();
  if (marketError) throw marketError;
  const { data: plan, error: planError } = await supabase
    .from("discovery_plans")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      campaign_run_id: run.id,
      market_analysis_id: market.id,
      version: 1,
      strategy_summary: "Synthetic deterministic discovery plan.",
      stop_conditions: { target: 1 },
      prompt_version: "deterministic-e2e-v1",
      requested_model: "fixture",
      actual_model: "fixture",
    })
    .select("id")
    .single();
  if (planError) throw planError;
  const { data: path, error: pathError } = await supabase
    .from("discovery_paths")
    .insert({
      workspace_id: workspace.id,
      discovery_plan_id: plan.id,
      external_id: "synthetic-direct-search",
      path_type: "direct_search",
      rationale: "Exercise clean staged persistence without an external provider.",
      expected_company_category: "Manufacturer",
      priority: 1,
      queries: ["Nordic industrial component manufacturer"],
      source_hints: ["company website"],
      expected_yield: "low",
      max_results: 5,
    })
    .select("id")
    .single();
  if (pathError) throw pathError;
  const { data: iteration, error: iterationError } = await supabase
    .from("discovery_iterations")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      campaign_run_id: run.id,
      discovery_plan_id: plan.id,
      iteration_number: 1,
      objective: "Find one deterministic fixture company.",
      decision: "target_reached",
      decision_reason: "The fixture target was reached.",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (iterationError) throw iterationError;
  const { data: query, error: queryError } = await supabase
    .from("discovery_queries")
    .insert({
      workspace_id: workspace.id,
      discovery_iteration_id: iteration.id,
      discovery_path_id: path.id,
      query: "Nordic industrial component manufacturer",
      source_type: "company_website",
      result_limit: 5,
      provider: "deterministic_fixture",
      provider_request_id: `fixture-${input.suffix}`,
      retrieved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (queryError) throw queryError;
  const { data: candidate, error: candidateError } = await supabase
    .from("discovery_candidates")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      campaign_run_id: run.id,
      discovery_iteration_id: iteration.id,
      discovery_query_id: query.id,
      candidate_key: "domain:synthetic.example.com",
      company_name: "Synthetic Components",
      normalized_domain: "synthetic.example.com",
      source_url: "https://synthetic.example.com/about",
      source_type: "company_website",
      source_query: "Nordic industrial component manufacturer",
      source_path: "synthetic-direct-search",
      snippet: "Synthetic industrial component manufacturer.",
      country_region: "Finland",
      probable_category: "Manufacturer",
      discovery_confidence: 1,
      retrieved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (candidateError) throw candidateError;
  const { error: classificationError } = await supabase
    .from("candidate_classifications")
    .insert({
      workspace_id: workspace.id,
      campaign_run_id: run.id,
      candidate_id: candidate.id,
      status: "promising",
      confidence: 1,
      probable_category: "Manufacturer",
      geography_match: true,
      reasons: ["Deterministic fixture matches the campaign."],
      should_evaluate: true,
      model_role: "search_result_classification",
      prompt_version: "deterministic-e2e-v1",
      requested_model: "fixture",
      actual_model: "fixture",
      input_hash: `classification-${input.suffix}`,
    });
  if (classificationError) throw classificationError;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      workspace_id: workspace.id,
      name: "Synthetic Components",
      normalized_name: "synthetic components",
      website_url: "https://synthetic.example.com",
      country: "Finland",
      city: "Helsinki",
      company_type: "Manufacturer",
      industry: "Industrial components",
      estimated_size: "50-200 employees",
      description: "Synthetic browser-test company",
    })
    .select("id")
    .single();
  if (companyError) throw companyError;
  const { data: source, error: sourceError } = await supabase
    .from("company_sources")
    .insert({
      workspace_id: workspace.id,
      company_id: company.id,
      campaign_run_id: run.id,
      provider: "deterministic_fixture",
      source_type: "company_website",
      title: "Synthetic company page",
      source_url: "https://synthetic.example.com/about",
      original_url: "https://synthetic.example.com/about",
      excerpt: "The company publicly describes industrial component manufacturing.",
    })
    .select("id")
    .single();
  if (sourceError) throw sourceError;
  const { data: association, error: associationError } = await supabase
    .from("campaign_companies")
    .insert({
      workspace_id: workspace.id,
      campaign_id: campaign.id,
      campaign_run_id: run.id,
      company_id: company.id,
      status: "approved",
      source_summary: "Deterministic public company evidence.",
    })
    .select("id")
    .single();
  if (associationError) throw associationError;
  const { data: qualification, error: qualificationError } = await supabase
    .from("qualification_results")
    .insert({
      workspace_id: workspace.id,
      campaign_company_id: association.id,
      campaign_run_id: run.id,
      status: "qualified",
      score: 88,
      confidence: "high",
      summary: "The fixture company matches the campaign.",
      schema_version: "qualification-v1",
      prompt_version: "deterministic-e2e-v1",
      input_hash: `qualification-${input.suffix}`,
    })
    .select("id")
    .single();
  if (qualificationError) throw qualificationError;
  const { error: evidenceError } = await supabase.from("qualification_evidence").insert({
    workspace_id: workspace.id,
    qualification_result_id: qualification.id,
    criterion: "industry fit",
    evidence_kind: "fact",
    statement: "The company manufactures industrial components.",
    source_url: "https://synthetic.example.com/about",
    source_id: source.id,
    confidence: "high",
  });
  if (evidenceError) throw evidenceError;
  const { data: method, error: methodError } = await supabase
    .from("contact_methods")
    .insert({
      workspace_id: workspace.id,
      company_id: company.id,
      method_type: "general_company_email",
      value: "sales@synthetic.example.com",
      normalized_value: "sales@synthetic.example.com",
      verification_status: "source_confirmed",
      is_primary: true,
    })
    .select("id")
    .single();
  if (methodError) throw methodError;
  const { error: contactSourceError } = await supabase.from("contact_sources").insert({
    workspace_id: workspace.id,
    contact_method_id: method.id,
    provider: "deterministic_fixture",
    source_url: "https://synthetic.example.com/contact",
    source_title: "Synthetic contact page",
  });
  if (contactSourceError) throw contactSourceError;
  const { data: campaignContact, error: campaignContactError } = await supabase
    .from("campaign_contacts")
    .insert({
      workspace_id: workspace.id,
      campaign_company_id: association.id,
      contact_method_id: method.id,
      role_relevance: "Sales department",
      selection_status: "recommended",
      recommendation_reason: "Synthetic accepted recipient",
    })
    .select("id")
    .single();
  if (campaignContactError) throw campaignContactError;
  const { error: draftError } = await supabase.from("outreach_drafts").insert({
    workspace_id: workspace.id,
    campaign_id: campaign.id,
    campaign_run_id: run.id,
    campaign_company_id: association.id,
    campaign_contact_id: campaignContact.id,
    profile_snapshot_id: campaign.profile_snapshot_id,
    strategy_version_id: campaign.current_strategy_version_id,
    subject: "Maintenance planning",
    body: "Hello, this is a grounded synthetic browser-test draft.",
    variant: "primary",
    language: "English",
    status: "needs_review",
    seller_claims: ["Preventive maintenance"],
    evidence_used: [source.id],
    warnings: [],
    prompt_version: "deterministic-e2e-v1",
    input_hash: `draft-${input.suffix}`,
    generated_at: new Date().toISOString(),
  });
  if (draftError) throw draftError;
}

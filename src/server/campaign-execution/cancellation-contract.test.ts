import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

test("stop persists cancellation and requests cancellation of linked Trigger runs", () => {
  const research = source("../research/repository.ts");
  const dispatch = source("../trigger/dispatch.ts");
  const actions = source("../campaigns/actions.ts");

  assert.match(dispatch, /runs\.cancel\(runId\)/);
  assert.match(research, /stopActiveCampaignRun/);
  assert.match(research, /status:\s*"cancelled"/);
  assert.match(research, /current_phase:\s*"cancelled"/);
  assert.match(research, /cancelTriggerRuns\(\[/);
  assert.match(actions, /await stopActiveCampaignRun/);
});

test("long discovery work cooperatively checks cancellation before provider stages", () => {
  const discovery = source("../campaign-discovery/service.ts");
  const orchestration = source("./service.ts");

  assert.ok(
    discovery.match(/await assertCampaignRunCanContinue\(context\)/g)!.length >= 4,
  );
  assert.match(discovery, /\[cancellation\] Campaign stopped by the user/);
  assert.match(orchestration, /if \(currentRun\.status === "cancelled"\) return/);
  assert.match(orchestration, /if \(run\.status === "cancelled"\) return/);
});

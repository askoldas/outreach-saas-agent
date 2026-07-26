import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configure, runs, tasks } from "@trigger.dev/sdk";

loadLocalEnv();

const secretKey = process.env.TRIGGER_SECRET_KEY;
if (!secretKey) throw new Error("TRIGGER_SECRET_KEY is missing from .env.local.");

configure({ accessToken: secretKey });

const handle = await tasks.trigger("verify-campaign-run", {});
console.log(`Triggered ${handle.id}.`);

for (let attempt = 0; attempt < 30; attempt += 1) {
  const run = await runs.retrieve(handle.id);
  const status = run.status;

  if (status === "COMPLETED") {
    console.log(`Trigger smoke test completed: ${handle.id}.`);
    process.exit(0);
  }

  if (
    status === "FAILED" ||
    status === "CRASHED" ||
    status === "CANCELED" ||
    status === "SYSTEM_FAILURE"
  ) {
    throw new Error(`Trigger smoke test ${handle.id} ended with status ${status}.`);
  }

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
}

throw new Error(`Timed out waiting for Trigger smoke test ${handle.id}.`);

function loadLocalEnv() {
  const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [name, ...parts] = trimmed.split("=");
    if (!name || process.env[name]) continue;
    process.env[name] = parts.join("=").replace(/^['"]|['"]$/g, "");
  }
}

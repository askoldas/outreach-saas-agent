import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configure, runs } from "@trigger.dev/sdk";

const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const line of contents.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [name, ...parts] = trimmed.split("=");
  if (name && !process.env[name]) {
    process.env[name] = parts.join("=").replace(/^['"]|['"]$/g, "");
  }
}
configure({ accessToken: process.env.TRIGGER_SECRET_KEY });
const rootId = process.argv[2];
const seen = new Set();
const failures = new Map();
const statuses = new Map();
await inspect(rootId, 0);

console.log(JSON.stringify({ statuses: Object.fromEntries(statuses) }));
for (const failure of failures.values()) {
  console.log(JSON.stringify(failure));
}

async function inspect(runId, depth) {
  if (seen.has(runId)) return;
  seen.add(runId);
  const run = await runs.retrieve(runId);
  statuses.set(run.status, (statuses.get(run.status) ?? 0) + 1);
  if (depth === 0) console.log(JSON.stringify({ id: run.id, status: run.status }));
  if (run.isFailed) {
    const error = run.error?.message ?? "Unknown error";
    const key = `${run.taskIdentifier}\u0000${error}`;
    const failure = failures.get(key) ?? {
      count: 0,
      error,
      exampleIds: [],
      task: run.taskIdentifier,
    };
    failure.count += 1;
    if (failure.exampleIds.length < 3) failure.exampleIds.push(run.id);
    failures.set(key, failure);
  }
  for (const child of run.relatedRuns.children ?? []) await inspect(child.id, depth + 1);
}

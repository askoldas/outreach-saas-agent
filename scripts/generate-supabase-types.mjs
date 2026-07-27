import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(resolve(root, ".env.local"));
} catch {
  // CI may provide environment variables directly.
}

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
if (!configuredUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
}

const hostname = new URL(configuredUrl).hostname;
const projectRef = hostname.endsWith(".supabase.co")
  ? hostname.slice(0, -".supabase.co".length)
  : null;

if (!projectRef) {
  throw new Error(`Cannot derive a hosted Supabase project from ${hostname}.`);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  command,
  [
    "supabase",
    "gen",
    "types",
    "typescript",
    "--project-id",
    projectRef,
    "--schema",
    "public",
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32",
  },
);

if (result.status !== 0) {
  throw new Error(
    result.error?.message ||
      result.stderr?.trim() ||
      `Supabase type generation exited with status ${result.status}.`,
  );
}

if (!result.stdout.includes("export type Database")) {
  throw new Error("Supabase CLI returned an unexpected type definition.");
}

const outputPath = resolve(root, "src", "types", "database.types.ts");
await writeFile(outputPath, result.stdout, "utf8");
console.log(`Generated ${outputPath} from project ${projectRef}.`);

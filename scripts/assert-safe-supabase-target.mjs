import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const approvedNewProjectRef = "aqhuzmqzeipubxrxadyj";
try {
  process.loadEnvFile(resolve(import.meta.dirname, "..", ".env.local"));
} catch {
  // CI and deployed environments may provide variables without a local env file.
}
const url = (
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ""
).trim();

let hostname;
try {
  hostname = new URL(url).hostname;
} catch {
  throw new Error("A valid SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
}

const actual = hostname.endsWith(".supabase.co")
  ? hostname.slice(0, -".supabase.co".length)
  : null;

if (!actual) {
  throw new Error(`Supabase URL is not a hosted Supabase project URL: ${hostname}`);
}

if (actual !== approvedNewProjectRef) {
  throw new Error(
    `Supabase project mismatch: this branch approves ${approvedNewProjectRef}, but the configured URL resolves to ${actual}.`,
  );
}

const linkedProjectPath = resolve(
  import.meta.dirname,
  "..",
  "supabase",
  ".temp",
  "project-ref",
);
let linkedProjectRef;
try {
  linkedProjectRef = (await readFile(linkedProjectPath, "utf8")).trim();
} catch {
  throw new Error(
    "Supabase CLI is not linked. Run `supabase link --project-ref aqhuzmqzeipubxrxadyj` first.",
  );
}

if (linkedProjectRef !== approvedNewProjectRef) {
  throw new Error(
    `Supabase CLI link mismatch: expected ${approvedNewProjectRef}, found ${linkedProjectRef || "an empty project reference"}.`,
  );
}

console.log(`Safe Supabase target confirmed: ${actual}.`);

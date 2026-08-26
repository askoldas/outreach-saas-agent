import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const line of contents.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [name, ...parts] = trimmed.split("=");
  if (name && !process.env[name]) {
    process.env[name] = parts.join("=").replace(/^['"]|['"]$/g, "");
  }
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data, error } = await db.rpc("inspect_entity_resolution_v2_definition");
if (error) throw error;
const marker = "Entity Resolution candidate set does not match";
const index = data.indexOf(marker);
console.log(index >= 0 ? data.slice(Math.max(0, index - 5_000), index + 500) : data);

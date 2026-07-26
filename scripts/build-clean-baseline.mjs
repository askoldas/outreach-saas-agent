import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const baselineDirectory = resolve(root, "supabase", "baseline");
const migrationPath = resolve(
  root,
  "supabase",
  "migrations",
  "20260725000100_opptium_clean_baseline.sql",
);

const files = (await readdir(baselineDirectory))
  .filter((file) => /^\d{3}_.+\.sql$/.test(file))
  .sort();

if (files.length !== 15) {
  throw new Error(`Expected 15 clean baseline parts, found ${files.length}.`);
}

const sections = await Promise.all(
  files.map(async (file) => {
    const source = await readFile(resolve(baselineDirectory, file), "utf8");
    return `-- Source: supabase/baseline/${file}\n\n${source.trim()}\n`;
  }),
);

const output = [
  "-- GENERATED FILE: edit supabase/baseline/*.sql and run:",
  "-- node scripts/build-clean-baseline.mjs",
  "-- Clean baseline for a brand-new empty Opptium Supabase project.",
  "",
  ...sections,
].join("\n");

await writeFile(migrationPath, output, "utf8");
console.log(`Built ${migrationPath} from ${files.length} ordered parts.`);

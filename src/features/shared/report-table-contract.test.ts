import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("compact report tables use fixed density and intentional expanded rows", async () => {
  const css = await readFile(new URL("./Feature.module.css", import.meta.url), "utf8");
  assert.match(css, /table-layout: fixed/);
  assert.match(css, /var\(--table-row-height\)/);
  assert.match(css, /text-overflow: ellipsis/);
  assert.match(css, /\.expandedRow td/);
});

test("generic company channels are not rendered as person leads", async () => {
  const contacts = await readFile(
    new URL("../../app/(app)/leads/contacts/page.tsx", import.meta.url),
    "utf8",
  );
  const companies = await readFile(
    new URL("../leads/GlobalCompaniesTable.tsx", import.meta.url),
    "utf8",
  );
  assert.match(contacts, /0 person leads/);
  assert.match(contacts, /company-level public channels/);
  assert.match(companies, /Public company channels/);
  assert.match(companies, /Named person contacts are not represented/);
});

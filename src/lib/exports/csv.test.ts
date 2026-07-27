import assert from "node:assert/strict";
import test from "node:test";
import { renderFrozenExportCsv } from "./csv.ts";

test("renders a frozen outreach export with CSV escaping", () => {
  const csv = renderFrozenExportCsv({
    type: "outreach_csv",
    rows: [
      {
        company: 'Acme "North"',
        recipientRoute: "sales@acme.test",
        subject: "Hello",
        body: "One, two",
      },
    ],
  });
  assert.match(csv, /"Acme ""North"""/);
  assert.match(csv, /"One, two"/);
});

test("renders nested frozen lead evidence and contacts", () => {
  const csv = renderFrozenExportCsv({
    type: "lead_research_csv",
    rows: [
      {
        company: "Acme",
        evidence: [{ text: "Public fact", sourceUrl: "https://acme.test" }],
        contacts: [{ value: "hello@acme.test" }],
      },
    ],
  });
  assert.match(csv, /Public fact/);
  assert.match(csv, /hello@acme\.test/);
});

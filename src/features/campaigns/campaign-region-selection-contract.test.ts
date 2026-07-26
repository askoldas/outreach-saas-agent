import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formUrl = new URL("./CampaignBriefForm.tsx", import.meta.url);
const stylesUrl = new URL("./CampaignGuided.module.css", import.meta.url);

test("campaign region cards expose and display their selected state", async () => {
  const [form, styles] = await Promise.all([
    readFile(formUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(form, /aria-pressed=\{regionLabel === region\.label\}/);
  assert.match(form, /data-selected=\{regionLabel === region\.label\}/);
  assert.match(styles, /\.option\[data-selected="true"\]/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { chunkDocumentText, DOCUMENT_LIMITS } from "./text-chunker.ts";

test("document text is normalized and deterministically bounded", () => {
  const chunks = chunkDocumentText(
    `Heading\r\n\r\n${"Useful market evidence. ".repeat(200)}`,
  );
  assert.ok(chunks.length > 1);
  assert.ok(chunks.length <= DOCUMENT_LIMITS.maxChunks);
  assert.ok(chunks.every((chunk) => chunk.length <= DOCUMENT_LIMITS.chunkCharacters));
  assert.doesNotMatch(chunks[0]!, /\r|\0/);
});

test("empty documents are rejected", () => {
  assert.throws(() => chunkDocumentText(" \0 \n "), /no readable text/);
});

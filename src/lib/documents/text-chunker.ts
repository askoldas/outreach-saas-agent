export const DOCUMENT_LIMITS = {
  maxBytes: 1_000_000,
  maxCharacters: 500_000,
  maxChunks: 100,
  chunkCharacters: 1_500,
  overlapCharacters: 150,
} as const;

export function chunkDocumentText(input: string) {
  const normalized = input
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, DOCUMENT_LIMITS.maxCharacters);
  if (!normalized) throw new Error("Document contains no readable text.");
  const chunks: string[] = [];
  let offset = 0;
  while (offset < normalized.length && chunks.length < DOCUMENT_LIMITS.maxChunks) {
    const hardEnd = Math.min(offset + DOCUMENT_LIMITS.chunkCharacters, normalized.length);
    const candidate = normalized.slice(offset, hardEnd);
    const softBreak = Math.max(
      candidate.lastIndexOf("\n\n"),
      candidate.lastIndexOf(". "),
    );
    const end =
      hardEnd < normalized.length && softBreak > DOCUMENT_LIMITS.chunkCharacters / 2
        ? offset + softBreak + 1
        : hardEnd;
    const content = normalized.slice(offset, end).trim();
    if (content) chunks.push(content);
    if (end >= normalized.length) break;
    offset = Math.max(end - DOCUMENT_LIMITS.overlapCharacters, offset + 1);
  }
  return chunks;
}

export function parseCompleteJsonObject(rawOutput: string): unknown {
  const normalized = rawOutput.trim().replace(/^\uFEFF/, "");
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    // Some providers wrap JSON in reasoning, prose, or Markdown fences.
  }
  let cursor = 0;
  while (cursor < normalized.length) {
    const start = normalized.indexOf("{", cursor);
    if (start < 0) break;
    const candidate = balancedObjectAt(normalized, start);
    if (!candidate) return undefined;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Ignore a balanced prose fragment and inspect the next top-level object.
    }
    cursor = start + candidate.length;
  }
  return undefined;
}

function balancedObjectAt(input: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < input.length; index += 1) {
    const character = input[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(start, index + 1);
    }
  }
  return null;
}

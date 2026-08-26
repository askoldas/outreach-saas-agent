export const DEFAULT_CANDIDATE_RESEARCH_WAVE_SIZE = 12;

export function partitionResearchWaves<T>(items: T[], waveSize: number): T[][] {
  if (!Number.isInteger(waveSize) || waveSize <= 0) {
    throw new Error("Candidate research wave size must be a positive integer.");
  }
  const waves: T[][] = [];
  for (let index = 0; index < items.length; index += waveSize) {
    waves.push(items.slice(index, index + waveSize));
  }
  return waves;
}

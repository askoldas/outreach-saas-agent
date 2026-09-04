import type { MarketEvidenceCorpus } from "./market-evidence.ts";

export const MARKET_SYNTHESIS_EVIDENCE_LIMIT = 30;

export type MarketEvidenceCategory =
  | "opportunity_lane"
  | "terminology"
  | "important_source"
  | "scale_driver"
  | "buying_signal"
  | "market_structure"
  | "contradiction_or_gap";

export function compileMarketEvidenceSynthesisInput(
  corpus: MarketEvidenceCorpus,
  maximum = MARKET_SYNTHESIS_EVIDENCE_LIMIT,
) {
  const questionById = new Map(corpus.questions.map((question) => [question.id, question]));
  const waveByEvidenceId = new Map(
    corpus.waves.flatMap((wave) => wave.evidenceIds.map((id) => [id, wave.waveNumber] as const)),
  );
  const annotated = corpus.evidence.map((item) => ({
    ...item,
    waveNumber: waveByEvidenceId.get(item.id) ?? questionById.get(item.questionId)?.waveNumber ?? 1,
    categories: evidenceCategories(item, questionById.get(item.questionId)?.direction),
  }));
  const selected: typeof annotated = [];
  const selectedIds = new Set<string>();
  const take = (candidates: typeof annotated) => {
    const item = candidates.find(({ id }) => !selectedIds.has(id));
    if (item && selected.length < maximum) {
      selected.push(item);
      selectedIds.add(item.id);
    }
  };
  const ranked = [...annotated].sort(
    (a, b) => authority(b) - authority(a) || (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) || a.id.localeCompare(b.id),
  );
  for (const wave of [...new Set(annotated.map(({ waveNumber }) => waveNumber))].sort())
    take(ranked.filter(({ waveNumber }) => waveNumber === wave));
  for (const category of CATEGORIES) take(ranked.filter(({ categories }) => categories.includes(category)));
  while (selected.length < Math.min(maximum, ranked.length)) take(ranked);

  const count = <T extends string | number>(values: T[]) =>
    Object.fromEntries([...new Set(values)].sort().map((key) => [String(key), values.filter((value) => value === key).length]));
  return {
    selectedEvidence: selected,
    waveSummaries: corpus.waveSummaries,
    omittedEvidenceStats: {
      totalEvidence: annotated.length,
      selectedEvidence: selected.length,
      byWave: count(selected.map(({ waveNumber }) => waveNumber)),
      byCategory: Object.fromEntries(CATEGORIES.map((category) => [category, selected.filter(({ categories }) => categories.includes(category)).length])),
    },
  };
}

const CATEGORIES: MarketEvidenceCategory[] = [
  "opportunity_lane", "terminology", "important_source", "scale_driver",
  "buying_signal", "market_structure", "contradiction_or_gap",
];

function evidenceCategories(item: MarketEvidenceCorpus["evidence"][number], direction?: string) {
  const text = `${item.title} ${item.excerpt} ${item.url}`.toLowerCase();
  const result = new Set<MarketEvidenceCategory>();
  if (direction === "lane_validation" || /buyer|venue|sector|operator|customer/.test(text)) result.add("opportunity_lane");
  if (direction === "terminology" || /terminolog|called|known as|latvian|local name/.test(text)) result.add("terminology");
  if (direction === "source_investigation" || item.sourceFamily !== "web_search" || /directory|association|registry|members/.test(text)) result.add("important_source");
  if (/capacity|employee|revenue|location|site|room|seat|scale|growth|expansion/.test(text)) result.add("scale_driver");
  if (/opening|renovation|tender|procurement|investment|hiring|contract|buying/.test(text)) result.add("buying_signal");
  if (/procurement|market structure|association|fragmented|consolidat|supply chain/.test(text)) result.add("market_structure");
  if (/decline|barrier|risk|weak|shortage|uncertain|gap|however|but /.test(text)) result.add("contradiction_or_gap");
  if (!result.size) result.add("opportunity_lane");
  return [...result];
}

function authority(item: MarketEvidenceCorpus["evidence"][number]) {
  return item.sourceFamily === "registry" ? 3 : item.sourceFamily === "association" ? 2 : item.sourceFamily === "news" ? 1 : 0;
}

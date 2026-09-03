type CandidateFact = { id: string; organizationId: string; state: string };
type QualificationFact = { candidateId: string; lane: string | null; status: string };
type DiscoveryLinkFact = { candidateId: string; sourceId: string };
type SourceFact = { id: string; provider: string; sourceType: string };

export function summarizeOutcomeEconomics(input: {
  actualCostUsd: number;
  billableCostUsd: number;
  candidates: CandidateFact[];
  qualificationFacts: QualificationFact[];
  discoveryLinks: DiscoveryLinkFact[];
  sources: SourceFact[];
}) {
  const candidateById = new Map(input.candidates.map((item) => [item.id, item]));
  const resolvedCandidateIds = new Set(
    input.candidates
      .filter(({ state }) => !["invalid", "merged", "archived"].includes(state))
      .map(({ id }) => id),
  );
  const evaluatedCandidateIds = new Set<string>();
  const qualifiedCandidateIds = new Set<string>();
  const duplicateCandidateIds = new Set(
    input.candidates.filter(({ state }) => state === "merged").map(({ id }) => id),
  );
  for (const fact of input.qualificationFacts) {
    if (fact.status !== "completed" || !fact.lane) continue;
    evaluatedCandidateIds.add(fact.candidateId);
    if (["recommended", "conditional"].includes(fact.lane))
      qualifiedCandidateIds.add(fact.candidateId);
    if (fact.lane === "duplicate") duplicateCandidateIds.add(fact.candidateId);
  }
  const qualifiedCompanyIds = companyIds(qualifiedCandidateIds, candidateById);
  const evaluatedCompanyIds = companyIds(evaluatedCandidateIds, candidateById);
  const resolvedCompanyIds = companyIds(resolvedCandidateIds, candidateById);
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const channels = new Map<
    string,
    {
      provider: string;
      sourceType: string;
      sourceIds: Set<string>;
      resolvedIds: Set<string>;
      qualifiedIds: Set<string>;
    }
  >();
  for (const link of input.discoveryLinks) {
    const source = sourceById.get(link.sourceId);
    const candidate = candidateById.get(link.candidateId);
    if (!source || !candidate) continue;
    const key = `${source.provider}:${source.sourceType}`;
    const channel = channels.get(key) ?? {
      provider: source.provider,
      sourceType: source.sourceType,
      sourceIds: new Set<string>(),
      resolvedIds: new Set<string>(),
      qualifiedIds: new Set<string>(),
    };
    channel.sourceIds.add(source.id);
    if (resolvedCandidateIds.has(candidate.id))
      channel.resolvedIds.add(candidate.organizationId);
    if (qualifiedCandidateIds.has(candidate.id))
      channel.qualifiedIds.add(candidate.organizationId);
    channels.set(key, channel);
  }
  const qualified = qualifiedCompanyIds.size;
  return {
    discoveredCompanies: new Set(
      input.candidates.map(({ organizationId }) => organizationId),
    ).size,
    resolvedCompanies: resolvedCompanyIds.size,
    evaluatedCompanies: evaluatedCompanyIds.size,
    qualifiedCompanies: qualified,
    duplicateCompanies: companyIds(duplicateCandidateIds, candidateById).size,
    qualificationRate: ratio(qualified, evaluatedCompanyIds.size),
    duplicateRate: ratio(duplicateCandidateIds.size, input.candidates.length),
    actualCostPerQualifiedCompany: ratio(input.actualCostUsd, qualified),
    billableCostPerQualifiedCompany: ratio(input.billableCostUsd, qualified),
    channels: [...channels.values()]
      .map((channel) => ({
        provider: channel.provider,
        sourceType: channel.sourceType,
        sourceRecords: channel.sourceIds.size,
        resolvedCompanies: channel.resolvedIds.size,
        qualifiedCompanies: channel.qualifiedIds.size,
        qualificationYield: ratio(channel.qualifiedIds.size, channel.resolvedIds.size),
      }))
      .sort(
        (left, right) =>
          right.qualifiedCompanies - left.qualifiedCompanies ||
          left.provider.localeCompare(right.provider) ||
          left.sourceType.localeCompare(right.sourceType),
      ),
  };
}

function companyIds(
  candidateIds: Set<string>,
  candidateById: Map<string, CandidateFact>,
) {
  return new Set(
    [...candidateIds].flatMap((id) => {
      const companyId = candidateById.get(id)?.organizationId;
      return companyId ? [companyId] : [];
    }),
  );
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

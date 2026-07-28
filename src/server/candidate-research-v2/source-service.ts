import { createHash } from "node:crypto";
import { createFirstPartyFetchRequest } from "@/lib/candidate-intelligence-v2";
import { extractWebPages } from "@/lib/providers/tavily";
import {
  persistCandidateResearchSource,
  type CandidateResearchMemberContext,
  type CandidateResearchSource,
} from "./repository";

const minimumReusableContentLength = 3_500;
const maximumStoredContentLength = 100_000;

export async function collectCandidateResearchSources(
  member: CandidateResearchMemberContext,
): Promise<{ sources: CandidateResearchSource[]; warnings: string[] }> {
  const sources = new Map(
    member.persistedSources.map((source) => [source.evidenceId, source] as const),
  );
  const warnings: string[] = [];
  const discoverySources = member.discoverySources
    .map((source) => ({
      ...source,
      content: rawContent(source.rawPayload),
    }))
    .filter(({ content, sourceUrl }) => Boolean(sourceUrl && content.trim()))
    .sort(
      (left, right) =>
        right.content.length - left.content.length ||
        left.providerSourceRecordId.localeCompare(right.providerSourceRecordId),
    )
    .slice(0, member.sourcePlan.maximumDiscoverySources);

  for (const source of discoverySources) {
    const content = source.content.slice(0, maximumStoredContentLength);
    const persisted = await persistCandidateResearchSource({
      workspaceId: member.workspaceId,
      memberId: member.memberId,
      sourceKind: "discovery",
      providerSourceRecordId: source.providerSourceRecordId,
      sourceUrl: source.sourceUrl!,
      pageKind: pageKind(source.rawPayload),
      content,
      contentHash: digest(content),
      retrievedAt: source.retrievedAt,
    });
    sources.set(persisted.evidenceId, persisted);
  }

  const hasFirstPartyFetch = [...sources.values()].some(
    ({ sourceKind }) => sourceKind === "first_party_fetch",
  );
  const availableContentLength = [...sources.values()].reduce(
    (total, source) => total + source.content.length,
    0,
  );
  if (
    !hasFirstPartyFetch &&
    availableContentLength < minimumReusableContentLength &&
    member.canonicalDomain &&
    member.canonicalUrl &&
    member.sourcePlan.maximumFirstPartyFetches > 0
  ) {
    try {
      const request = createFirstPartyFetchRequest({
        organizationId: member.organizationId,
        url: member.canonicalUrl,
        expectedDomain: member.canonicalDomain,
        pageKind: "home",
        questionKeys: member.plan.questions.map(({ key }) => key),
      });
      const [result] = await extractWebPages([request.canonicalUrl]);
      if (result?.content.trim()) {
        const content = result.content.slice(0, maximumStoredContentLength);
        const persisted = await persistCandidateResearchSource({
          workspaceId: member.workspaceId,
          memberId: member.memberId,
          sourceKind: "first_party_fetch",
          sourceUrl: request.canonicalUrl,
          pageKind: request.pageKind,
          content,
          contentHash: digest(content),
          retrievedAt: new Date().toISOString(),
        });
        sources.set(persisted.evidenceId, persisted);
      } else {
        warnings.push("The canonical homepage returned no usable public content.");
      }
    } catch (error) {
      warnings.push(
        `The canonical homepage could not be fetched: ${boundedMessage(error)}`,
      );
    }
  }

  return {
    sources: [...sources.values()].sort(
      (left, right) =>
        left.retrievedAt.localeCompare(right.retrievedAt) ||
        left.evidenceId.localeCompare(right.evidenceId),
    ),
    warnings,
  };
}

function rawContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const content = (value as Record<string, unknown>).content;
  return typeof content === "string" ? content : "";
}

function pageKind(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "other";
  const kind = (value as Record<string, unknown>).pageType;
  if (kind === "company_homepage") return "home";
  if (kind === "company_subpage") return "about";
  return "other";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function boundedMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

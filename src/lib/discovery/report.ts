import type {
  ContactDiscoveryReport,
  DiscoveryReport,
  DiscoveryReportAiFailure,
  DiscoveryReportRejectedResult,
  DiscoveryReportResult,
} from "@/types/domain";

export function calculateDiscoveryProgress(
  totalLeads: number,
  desiredLeadCount: number,
) {
  if (desiredLeadCount <= 0) {
    return totalLeads > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((totalLeads / desiredLeadCount) * 100));
}

export function buildDiscoveryReport(input: {
  aiQualificationFailures: DiscoveryReportAiFailure[];
  aiQualificationSuccesses: string[];
  contactDiscovery: ContactDiscoveryReport[];
  contactRoutesFound: number;
  duplicateResults: DiscoveryReportRejectedResult[];
  finalReviewableLeads: string[];
  leadsSavedBeforeAiQualification: string[];
  queriesExecuted: string[];
  rawTavilyResults: DiscoveryReportResult[];
  rejectedResults: DiscoveryReportRejectedResult[];
}): DiscoveryReport {
  return {
    ...input,
    generatedAt: new Date().toISOString(),
  };
}

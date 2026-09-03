import type { CompanyResearchCompletionReason } from "./outcome";

export function companyResearchOutcomeCopy(input: {
  completionReason: CompanyResearchCompletionReason | null;
  deliveredCompanyCount: number;
  requestedCompanyCount: number;
}) {
  const count = `${input.deliveredCompanyCount} / ${input.requestedCompanyCount}`;
  if (input.completionReason === "target_reached")
    return {
      title: "Requested companies found",
      description: `${count} strong matches are ready to review.`,
      suggestion: null,
    };
  if (input.completionReason === "market_exhausted")
    return {
      title: "Best matches in the current market found",
      description: `${count} companies met the campaign criteria. We did not weaken qualification standards to fill the remaining places.`,
      suggestion: "Keep these results, broaden the target, or expand the geography.",
    };
  if (input.completionReason === "internal_cost_guard")
    return {
      title: "Strong matches found so far",
      description: `${count} companies met the criteria before research reached its internal safety limit.`,
      suggestion:
        "Keep these results or adjust the target to open more productive routes.",
    };
  if (input.completionReason === "provider_failure")
    return {
      title: "Available matches preserved",
      description: `${count} companies are ready. A research source remained unavailable after retries.`,
      suggestion: "Use these results now or retry research later.",
    };
  if (input.completionReason === "user_stopped")
    return {
      title: "Research stopped",
      description: `${count} confirmed companies found before the stop are preserved.`,
      suggestion: null,
    };
  if (input.completionReason === "technical_failure")
    return {
      title: "Research needs attention",
      description: `${count} confirmed companies were preserved despite a technical problem.`,
      suggestion:
        "Review the saved results and retry after the reported issue is resolved.",
    };
  return {
    title: "Finding potential customers",
    description: `${count} companies confirmed. Qualified companies appear as soon as they are ready.`,
    suggestion: null,
  };
}

import type {
  Confidence,
  ContactRoute,
  FitLabel,
  LeadStatus,
  RecipientType,
  ReviewState,
} from "@/types/domain";

export function fitLabel(score: number): FitLabel {
  if (score >= 80) return "Strong fit";
  if (score >= 65) return "Good fit";
  if (score >= 45) return "Possible fit";
  return "Weak fit";
}

export function confidenceLabel(confidence: Confidence) {
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}`;
}

export function reviewState(status: LeadStatus): ReviewState {
  if (status === "approved" || status === "draft_ready") return "approved";
  if (status === "rejected" || status === "archived") return "rejected";
  return "ready";
}

export function leadReviewState(lead: {
  qualificationStatus: string;
  status: LeadStatus;
}): ReviewState {
  if (
    lead.qualificationStatus === "failed" &&
    (lead.status === "needs_review" || lead.status === "researching")
  )
    return "issues";
  if (lead.status === "archived") return "excluded";
  return reviewState(lead.status);
}

const recipientPriority: Record<RecipientType, number> = {
  named_person: 0,
  department: 1,
  sales: 2,
  general: 3,
  form: 4,
  none: 5,
};

export function contactType(route: ContactRoute): RecipientType {
  const value = `${route.type} ${route.suggestedRole}`.toLowerCase();
  if (value.includes("person") || value.includes("manager") || value.includes("director"))
    return "named_person";
  if (value.includes("department") || value.includes("purchasing")) return "department";
  if (value.includes("sales") || value.includes("partner")) return "sales";
  if (value.includes("form") || value.includes("page")) return "form";
  return route.value ? "general" : "none";
}

export function recommendContact(routes: ContactRoute[]) {
  return (
    [...routes].sort(
      (a, b) => recipientPriority[contactType(a)] - recipientPriority[contactType(b)],
    )[0] ?? null
  );
}

export function estimateCredits(
  operation: "research" | "enrichment" | "draft",
  count: number,
) {
  const unit = operation === "research" ? 5 : operation === "enrichment" ? 3 : 2;
  return Math.max(0, count) * unit;
}

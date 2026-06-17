import type {
  CampaignStatus,
  Confidence,
  DraftStatus,
  EvidenceKind,
  LeadStatus,
  OfferStatus,
} from "@/types/domain";

export function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function scoreTone(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export function confidenceTone(confidence: Confidence) {
  return confidence === "high" ? "success" : confidence === "medium" ? "warning" : "danger";
}

export function statusTone(
  status: OfferStatus | CampaignStatus | LeadStatus | DraftStatus | EvidenceKind,
) {
  switch (status) {
    case "active":
    case "approved":
    case "completed":
    case "draft_ready":
    case "fact":
      return "success";
    case "running":
    case "edited":
    case "inference":
      return "accent";
    case "planning":
    case "needs_review":
    case "researching":
    case "unknown":
      return "warning";
    case "rejected":
    case "archived":
    case "conflict":
      return "danger";
    default:
      return "neutral";
  }
}

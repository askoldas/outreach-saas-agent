import { Badge } from "@/components/ui/Badge";
import type { CampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";

export function CampaignRunTimeline({
  events,
}: {
  events: CampaignWorkflowSummary["runEvents"];
}) {
  if (!events.length) return null;
  return (
    <details>
      <summary>
        <strong>Run timeline ({events.length})</strong>
      </summary>
      <ol className={shared.feed}>
        {events.map((event) => (
          <li key={event.id}>
            <div>
              <Badge tone={levelTone(event.level)}>{event.level}</Badge>{" "}
              <strong>{event.phase?.replaceAll("_", " ") ?? "Campaign"}</strong>
            </div>
            <p>{event.summary}</p>
            <span>
              {formatDate(event.createdAt)} · {event.eventType.replaceAll("_", " ")}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function levelTone(level: string): "neutral" | "accent" | "warning" | "danger" {
  if (level === "error") return "danger";
  if (level === "warning") return "warning";
  if (level === "info") return "accent";
  return "neutral";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

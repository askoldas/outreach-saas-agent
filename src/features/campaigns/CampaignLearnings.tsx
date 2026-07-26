import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";
import { reviewCampaignMemoryAction } from "@/server/campaign-memories/actions";
import type { CampaignMemory } from "@/server/campaign-memories/repository";

export function CampaignLearnings({
  campaignId,
  memories,
}: Readonly<{ campaignId: string; memories: CampaignMemory[] }>) {
  if (memories.length === 0) return null;
  return (
    <section className={styles.stack}>
      <strong>Campaign learnings</strong>
      <span className={styles.secondaryText}>
        Only approved learnings influence future Campaign Agent planning.
      </span>
      {memories.map((memory) => (
        <div className={styles.stack} key={memory.id}>
          <div className={styles.filters}>
            <Badge tone={memory.approvalStatus === "approved" ? "success" : "warning"}>
              {memory.approvalStatus}
            </Badge>
            <Badge>{memory.category.replaceAll("_", " ")}</Badge>
            <Badge>{memory.confidence} confidence</Badge>
          </div>
          <span>{memory.statement}</span>
          {memory.approvalStatus === "proposed" ? (
            <form action={reviewCampaignMemoryAction} className={styles.filters}>
              <input name="campaignId" type="hidden" value={campaignId} />
              <input name="memoryId" type="hidden" value={memory.id} />
              <Button name="decision" type="submit" value="approved" variant="primary">
                Approve learning
              </Button>
              <Button name="decision" type="submit" value="rejected">
                Reject
              </Button>
            </form>
          ) : null}
        </div>
      ))}
    </section>
  );
}

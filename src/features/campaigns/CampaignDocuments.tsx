import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import form from "@/components/ui/FormControls.module.css";
import styles from "@/features/shared/Feature.module.css";
import { uploadCampaignDocumentAction } from "@/server/documents/actions";
import type { CampaignDocument } from "@/server/documents/repository";

export function CampaignDocuments({
  campaignId,
  documents,
}: Readonly<{ campaignId: string; documents: CampaignDocument[] }>) {
  return (
    <section className={styles.stack}>
      <strong>Campaign materials</strong>
      <span className={styles.secondaryText}>
        Private TXT, Markdown, CSV, or JSON files up to 1 MB. Uploaded content is
        untrusted context and cannot issue instructions to the agent.
      </span>
      <form action={uploadCampaignDocumentAction} className={styles.filters}>
        <input name="campaignId" type="hidden" value={campaignId} />
        <input
          className={form.input}
          name="document"
          type="file"
          accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
          required
        />
        <Button type="submit" variant="primary">
          Upload material
        </Button>
      </form>
      {documents.map((document) => (
        <div className={styles.filters} key={document.id}>
          <span>{document.fileName}</span>
          <Badge
            tone={
              document.status === "ready"
                ? "success"
                : document.status === "failed"
                  ? "danger"
                  : "warning"
            }
          >
            {document.status}
          </Badge>
        </div>
      ))}
    </section>
  );
}

import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace controls are represented as interface placeholders in this mock prototype."
      />
      <EmptyState
        title="No settings are connected"
        description="Authentication, billing, provider credentials, and team permissions are intentionally outside this prototype."
      />
    </>
  );
}

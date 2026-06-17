import { notFound } from "next/navigation";
import { getLead } from "@/data/mock/prospecting";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function LeadDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const lead = getLead(id);

  if (!lead) {
    notFound();
  }

  return (
    <PageHeader
      title={lead.company}
      description="Lead evidence and qualification detail will be added in the leads interface batch."
    />
  );
}

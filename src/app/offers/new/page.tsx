import { redirect } from "next/navigation";
import { OfferForm } from "@/features/offers/OfferForm";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { PageHeader } from "@/components/ui/PageHeader";

type SearchParams = {
  error?: string;
};

export default async function NewOfferPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Add offer"
        description={`Describe a product or service for ${currentWorkspace.name}.`}
      />
      <OfferForm error={params.error} />
    </>
  );
}

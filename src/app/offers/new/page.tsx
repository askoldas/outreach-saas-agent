import { OfferForm } from "@/features/offers/OfferForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewOfferPage() {
  return (
    <>
      <PageHeader
        title="Add offer"
        description="Describe a product or service without connecting to a backend. This prototype only shows the intended review workflow."
      />
      <OfferForm />
    </>
  );
}

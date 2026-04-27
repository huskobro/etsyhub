import { VariationsPage } from "@/features/variation-generation/components/variations-page";

export default function Page({ params }: { params: { id: string } }) {
  return <VariationsPage referenceId={params.id} />;
}

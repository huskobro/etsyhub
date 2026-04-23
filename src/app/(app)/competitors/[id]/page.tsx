import { db } from "@/server/db";
import { CompetitorDetailPage } from "@/features/competitors/components/competitor-detail-page";

type Props = { params: { id: string } };

export default async function Page({ params }: Props) {
  // ProductType'lar "Referans'a Taşı" akışında picker'ı doldurur.
  const productTypes = await db.productType.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  return (
    <CompetitorDetailPage
      competitorId={params.id}
      productTypes={productTypes}
    />
  );
}

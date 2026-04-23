import { db } from "@/server/db";
import { ReferencesPage } from "@/features/references/components/references-page";

export default async function Page() {
  const productTypes = await db.productType.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  return <ReferencesPage productTypes={productTypes} />;
}

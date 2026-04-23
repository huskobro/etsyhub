import { db } from "@/server/db";
import { BookmarksPage } from "@/features/bookmarks/components/bookmarks-page";

export default async function Page() {
  const productTypes = await db.productType.findMany({
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
  return <BookmarksPage productTypes={productTypes} />;
}

import { notFound } from "next/navigation";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { NotFoundError } from "@/lib/errors";
import { TrendStoriesPage } from "@/features/trend-stories/components/trend-stories-page";

export default async function Page() {
  try {
    await assertTrendStoriesAvailable();
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  return <TrendStoriesPage />;
}

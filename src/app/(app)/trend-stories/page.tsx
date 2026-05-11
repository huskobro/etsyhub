import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { assertTrendStoriesAvailable } from "@/features/trend-stories/services/feature-gate";
import { NotFoundError } from "@/lib/errors";
import { TrendStoriesPage } from "@/features/trend-stories/components/trend-stories-page";
import { ReferencesShellTabs } from "@/features/references/components/ReferencesShellTabs";
import { ReferencesTopbar } from "@/features/references/components/ReferencesTopbar";
import { getReferencesSubViewCounts } from "@/features/references/server/sub-view-counts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    await assertTrendStoriesAvailable();
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const counts = await getReferencesSubViewCounts(session.user.id);

  return (
    <div className="-m-6 flex h-screen flex-col">
      <ReferencesTopbar
        subtitle={`STORIES · ${counts.stories} NEW LISTING${counts.stories === 1 ? "" : "S"} THIS WEEK`}
      />
      <ReferencesShellTabs counts={counts} active="stories" />
      <div className="flex-1 overflow-y-auto p-6">
        <TrendStoriesPage />
      </div>
    </div>
  );
}
